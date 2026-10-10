import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { CAMPUS, locationById, severityRank, type Severity } from "@/lib/campus";
import type { LivePayload, QueueItem, RecentSos, Responder, SosAlert } from "@/lib/types";
import { iso } from "@/lib/utils";
import { catName, locName, requireAdmin } from "./helpers";
import { ensureSeedData } from "./seed";
import { fetchSos } from "./sos";

type Sql = Awaited<ReturnType<typeof getSql>>;

export type AdminCounters = {
  activeSos: number;
  incoming: number;
  inProgress: number;
  resolvedToday: number;
  criticalOpen: number;
};

async function loadCounters(sql: Sql): Promise<AdminCounters> {
  const activeSosRows = await sql<{ n: number }>`
    select count(*)::int as n from sos_alerts where status not in ('resolved','cancelled')
  `;
  const incomingRows = await sql<{ n: number }>`
    select count(*)::int as n from (
      select id from incidents where status = 'reported'
      union all
      select id from anonymous_reports where status = 'reported'
      union all
      select id from sos_alerts where status in ('sent','received')
    ) t
  `;
  const inProgRows = await sql<{ n: number }>`
    select count(*)::int as n from (
      select id from incidents where status in ('under_review','in_progress')
      union all
      select id from anonymous_reports where status in ('under_review','in_progress')
      union all
      select id from sos_alerts where status in ('assigned','arrived')
    ) t
  `;
  const resolvedRows = await sql<{ n: number }>`
    select count(*)::int as n from (
      select id from incidents where status in ('resolved','closed') and created_at >= date_trunc('day', now())
      union all
      select id from anonymous_reports where status in ('resolved','closed') and created_at >= date_trunc('day', now())
      union all
      select id from sos_alerts where status = 'resolved' and coalesce(resolved_at, started_at) >= date_trunc('day', now())
    ) t
  `;
  const criticalRows = await sql<{ n: number }>`
    select count(*)::int as n from (
      select id from incidents where severity = 'P1' and status not in ('resolved','closed')
      union all
      select id from anonymous_reports where severity = 'P1' and status not in ('resolved','closed')
    ) t
  `;
  return {
    activeSos: activeSosRows[0]?.n ?? 0,
    incoming: incomingRows[0]?.n ?? 0,
    inProgress: inProgRows[0]?.n ?? 0,
    resolvedToday: resolvedRows[0]?.n ?? 0,
    criticalOpen: criticalRows[0]?.n ?? 0,
  };
}

/**
 * Counters are identical for every admin, and every open console polls them.
 * Share one result per process for a few seconds so N open consoles cost one
 * set of count queries, not N.
 */
const COUNTERS_TTL_MS = 3000;
const countersCache = globalThis as typeof globalThis & {
  __adminCounters__?: { at: number; value: Promise<AdminCounters> };
};

function loadCountersCached(sql: Sql): Promise<AdminCounters> {
  const hit = countersCache.__adminCounters__;
  if (hit && Date.now() - hit.at < COUNTERS_TTL_MS) return hit.value;
  const value = loadCounters(sql).catch((err) => {
    countersCache.__adminCounters__ = undefined;
    throw err;
  });
  countersCache.__adminCounters__ = { at: Date.now(), value };
  return value;
}

/** Open critical items: live SOS alerts plus open P1 incidents and anonymous reports. */
const CRITICAL_ITEMS = `
  select 'sos' as kind, id, null as category_id, null as location_id, status, started_at as at
    from sos_alerts where status not in ('resolved','cancelled')
  union all
  select 'incident', id, category_id, location_id, status, created_at
    from incidents where severity = 'P1' and status not in ('resolved','closed')
  union all
  select 'anonymous', id, category_id, location_id, status, created_at
    from anonymous_reports where severity = 'P1' and status not in ('resolved','closed')
`;

async function countUnseenCritical(sql: Sql, userId: string): Promise<number> {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from (${CRITICAL_ITEMS}) t
     where t.at > coalesce((select notifications_seen_at from profiles where user_id = $1), '-infinity'::timestamptz)`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** Lightweight counters for the admin shell (badges + topbar pills), polled on every admin page. */
export const getAdminCounters = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminCounters & { unseenCritical: number }> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const [counters, unseenCritical] = await Promise.all([
      loadCountersCached(sql),
      countUnseenCritical(sql, context.userId),
    ]);
    return { ...counters, unseenCritical };
  });

export type AdminNotification = {
  kind: "sos" | "incident" | "anonymous";
  id: string;
  title: string;
  place: string | null;
  status: string;
  at: string;
  /** Arrived after this admin last opened the bell. */
  unseen: boolean;
};

/** The bell's list: newest open critical items, flagged new/seen for this admin. */
export const getAdminNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminNotification[]> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{
      kind: AdminNotification["kind"];
      id: string;
      category_id: string | null;
      location_id: string | null;
      status: string;
      at: unknown;
      unseen: boolean;
    }>(
      `select t.*, t.at > coalesce(p.notifications_seen_at, '-infinity'::timestamptz) as unseen
       from (${CRITICAL_ITEMS}) t
       left join profiles p on p.user_id = $1
       order by t.at desc
       limit 25`,
      [context.userId],
    );
    return rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      title: r.kind === "sos" ? "Live SOS alert" : catName(r.category_id),
      place: r.location_id ? locName(r.location_id) : r.kind === "sos" ? "Live GPS" : null,
      status: r.status,
      at: iso(r.at),
      unseen: Boolean(r.unseen),
    }));
  });

/** Opening the bell marks everything up to now as seen — for this admin only. */
export const markAdminNotificationsSeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`update profiles set notifications_seen_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export type AnalyticsPayload = {
  totals: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    resolutionRate: number;
  };
  severities: { severity: Severity; count: number }[];
  statuses: { status: string; count: number }[];
  reporting: { identified: number; anonymous: number; sos: number };
};

/** Breakdowns from the original Admin analytics screen, computed from real records. */
export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AnalyticsPayload> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const statusRows = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from (
        select status from incidents union all select status from anonymous_reports
      ) t group by status
    `;
    const severityRows = await sql<{ severity: Severity; n: number }>`
      select severity, count(*)::int as n from (
        select severity from incidents union all select severity from anonymous_reports
      ) t group by severity order by severity
    `;
    const reportingRows = await sql<{ identified: number; anonymous: number; sos: number }>`
      select (select count(*)::int from incidents) as identified,
             (select count(*)::int from anonymous_reports) as anonymous,
             (select count(*)::int from sos_alerts) as sos
    `;
    const count = (...names: string[]) =>
      statusRows.filter((r) => names.includes(r.status)).reduce((a, r) => a + r.n, 0);
    const total = statusRows.reduce((a, r) => a + r.n, 0);
    const resolved = count("resolved", "closed");
    return {
      totals: {
        total,
        open: count("reported", "under_review"),
        inProgress: count("in_progress"),
        resolved,
        resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
      },
      severities: (["P1", "P2", "P3", "P4"] as const).map((sev) => ({
        severity: sev,
        count: severityRows.find((r) => r.severity === sev)?.n ?? 0,
      })),
      statuses: statusRows.map((r) => ({ status: r.status, count: r.n })),
      reporting: reportingRows[0] ?? { identified: 0, anonymous: 0, sos: 0 },
    };
  });

export const getLive = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LivePayload> => {
    await requireAdmin(context.userId);
    await ensureSeedData();
    const sql = await getSql();

    const counters = await loadCountersCached(sql);

    const sosOpen = await sql<{
      id: string;
      user_id: string;
      status: SosAlert["status"];
      lat: number | null;
      lng: number | null;
      accuracy_m: number | null;
      is_approximate: boolean;
      assigned_to: string | null;
      notes: string | null;
      started_at: unknown;
      received_at: unknown;
      assigned_at: unknown;
      arrived_at: unknown;
      resolved_at: unknown;
      reporter_name: string | null;
      assigned_name: string | null;
      last_ping_at: unknown;
    }>`
      select s.id, s.user_id, s.status, s.lat, s.lng, s.accuracy_m, s.is_approximate,
             s.assigned_to, s.notes, s.started_at, s.received_at, s.assigned_at, s.arrived_at, s.resolved_at,
             p.name as reporter_name, r.name as assigned_name,
             (select max(l.recorded_at) from sos_locations l where l.alert_id = s.id) as last_ping_at
      from sos_alerts s
      left join profiles p on p.user_id = s.user_id
      left join responders r on r.id = s.assigned_to
      where s.status not in ('resolved','cancelled')
      order by s.started_at asc
    `;

    const incidentsOpen = await sql<{
      id: string;
      category_id: string;
      location_id: string | null;
      severity: Severity;
      status: string;
      lat: number | null;
      lng: number | null;
      created_at: unknown;
    }>`
      select id, category_id, location_id, severity, status, lat, lng, created_at
      from incidents
      where status not in ('resolved','closed')
      order by created_at asc
    `;

    const anonOpen = await sql<{
      id: string;
      category_id: string;
      location_id: string;
      severity: Severity;
      status: string;
      created_at: unknown;
    }>`
      select id, category_id, location_id, severity, status, created_at
      from anonymous_reports
      where status not in ('resolved','closed')
      order by created_at asc
    `;

    const queue: QueueItem[] = [
      ...sosOpen.map((s) => ({
        id: s.id,
        kind: "sos" as const,
        title: "SOS alert",
        place: "Live GPS",
        severity: "P1" as const,
        status: s.status,
        startedAt: iso(s.started_at),
        lat: s.lat,
        lng: s.lng,
      })),
      ...incidentsOpen.map((i) => ({
        id: i.id,
        kind: "incident" as const,
        title: catName(i.category_id),
        place: i.location_id ? locName(i.location_id) : "Dropped pin",
        severity: i.severity,
        status: i.status,
        startedAt: iso(i.created_at),
        lat: i.lat,
        lng: i.lng,
      })),
      ...anonOpen.map((a) => {
        const loc = locationById(a.location_id);
        return {
          id: a.id,
          kind: "anonymous" as const,
          title: catName(a.category_id),
          place: locName(a.location_id),
          severity: a.severity,
          status: a.status,
          startedAt: iso(a.created_at),
          lat: loc?.lat ?? CAMPUS.center.lat,
          lng: loc?.lng ?? CAMPUS.center.lng,
        };
      }),
    ];

    queue.sort((a, b) => {
      const kindRank = (k: QueueItem["kind"]) => (k === "sos" ? 0 : 1);
      const kr = kindRank(a.kind) - kindRank(b.kind);
      if (kr) return kr;
      const sr = severityRank(a.severity) - severityRank(b.severity);
      if (sr) return sr;
      return +new Date(a.startedAt) - +new Date(b.startedAt);
    });

    const sos: SosAlert[] = sosOpen.map((s) => ({
      id: s.id,
      userId: s.user_id,
      reporterName: s.reporter_name ?? "Campus member",
      reporterPhone: null,
      reporterAvatar: null,
      reporterMedical: null,
      status: s.status,
      lat: s.lat,
      lng: s.lng,
      accuracyM: s.accuracy_m,
      isApproximate: Boolean(s.is_approximate),
      assignedTo: s.assigned_to,
      assignedName: s.assigned_name,
      assignedPhone: null,
      notes: s.notes,
      startedAt: iso(s.started_at),
      receivedAt: s.received_at ? iso(s.received_at) : null,
      assignedAt: s.assigned_at ? iso(s.assigned_at) : null,
      arrivedAt: s.arrived_at ? iso(s.arrived_at) : null,
      resolvedAt: s.resolved_at ? iso(s.resolved_at) : null,
      lastPingAt: s.last_ping_at ? iso(s.last_ping_at) : null,
    }));

    // Last 40 GPS points per open alert, for live trails on the map.
    const openIds = sosOpen.map((s) => s.id);
    const trailRows = openIds.length
      ? await sql.query<{ alert_id: string; lat: number; lng: number }>(
          `select alert_id, lat, lng from (
             select alert_id, lat, lng, recorded_at,
                    row_number() over (partition by alert_id order by recorded_at desc) as rn
             from sos_locations where alert_id = any($1)
           ) t where rn <= 40 order by alert_id, recorded_at asc`,
          [openIds],
        )
      : [];
    // Closed in the last 24h, so command sees "marked safe" instead of the alert vanishing.
    const recentRows = await sql<{
      id: string;
      status: "resolved" | "cancelled";
      started_at: unknown;
      resolved_at: unknown;
      lat: number | null;
      lng: number | null;
      is_approximate: boolean;
      reporter_name: string | null;
      assigned_name: string | null;
      marked_safe: boolean;
    }>`
      select s.id, s.status, s.started_at, s.resolved_at, s.lat, s.lng, s.is_approximate,
             p.name as reporter_name, r.name as assigned_name,
             exists (
               select 1 from audit_log a
               where a.subject_kind = 'sos' and a.subject_id = s.id and a.action = 'sos.safe'
             ) as marked_safe
      from sos_alerts s
      left join profiles p on p.user_id = s.user_id
      left join responders r on r.id = s.assigned_to
      where s.status in ('resolved', 'cancelled')
        and coalesce(s.resolved_at, s.started_at) >= now() - interval '24 hours'
      order by coalesce(s.resolved_at, s.started_at) desc
      limit 20
    `;
    const recentSos: RecentSos[] = recentRows.map((s) => ({
      id: s.id,
      reporterName: s.reporter_name ?? "Campus member",
      status: s.status,
      closedBy: s.status === "cancelled" ? "cancelled" : s.marked_safe ? "reporter" : "command",
      startedAt: iso(s.started_at),
      closedAt: iso(s.resolved_at ?? s.started_at),
      assignedName: s.assigned_name,
      lat: s.lat,
      lng: s.lng,
      isApproximate: Boolean(s.is_approximate),
    }));

    const trails = openIds.map((alertId) => ({
      alertId,
      points: trailRows
        .filter((r) => r.alert_id === alertId)
        .map((r) => ({ lat: r.lat, lng: r.lng })),
    }));

    const dailyRows = await sql<{ day: string; count: number }>`
      select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as count
      from generate_series(now()::date - 13, now()::date, interval '1 day') d
      left join (
        select created_at::date as day, count(*)::int as n from (
          select created_at from incidents
          union all
          select created_at from anonymous_reports
          union all
          select started_at from sos_alerts
        ) x group by 1
      ) c on c.day = d::date
      order by 1
    `;
    const today = new Date().toISOString().slice(0, 10);
    const daily = dailyRows.map((r) => ({
      day: r.day,
      count: r.count,
      isToday: r.day === today,
    }));

    const hotspotRows = await sql<{ location_id: string; n: number }>`
      select location_id, count(*)::int as n from (
        select location_id from incidents where location_id is not null
        union all
        select location_id from anonymous_reports
      ) t group by location_id order by n desc limit 6
    `;
    const catRows = await sql<{ category_id: string; n: number }>`
      select category_id, count(*)::int as n from (
        select category_id from incidents
        union all
        select category_id from anonymous_reports
      ) t group by category_id order by n desc
    `;

    const avgRows = await sql<{ mins: number | null }>`
      select avg(extract(epoch from (coalesce(resolved_at, now()) - started_at)) / 60)::int as mins
      from sos_alerts
      where started_at >= now() - interval '14 days'
    `;

    const responderRows = await sql<{
      id: string;
      name: string;
      unit: string;
      phone: string | null;
      user_id: string | null;
      status: Responder["status"];
    }>`select id, name, unit, phone, user_id, status from responders order by unit`;

    const incidentPins = await sql<{
      id: string;
      lat: number;
      lng: number;
      severity: Severity;
    }>`select id, lat, lng, severity from incidents where lat is not null and lng is not null and status not in ('closed')`;

    const anonPins = anonOpen.map((a) => {
      const loc = locationById(a.location_id);
      return {
        id: a.id,
        lat: loc?.lat ?? CAMPUS.center.lat,
        lng: loc?.lng ?? CAMPUS.center.lng,
        severity: a.severity,
      };
    });

    return {
      counters: {
        activeSos: counters.activeSos,
        incoming: counters.incoming,
        inProgress: counters.inProgress,
        resolvedToday: counters.resolvedToday,
      },
      queue,
      sos,
      incidents: incidentPins,
      anonymous: anonPins,
      daily,
      hotspots: hotspotRows.map((h) => ({
        locationId: h.location_id,
        name: locName(h.location_id),
        count: h.n,
      })),
      categories: catRows.map((c) => ({
        categoryId: c.category_id,
        name: catName(c.category_id),
        count: c.n,
      })),
      avgResponseMin: avgRows[0]?.mins ?? 0,
      trails,
      recentSos,
      responders: responderRows.map((r) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        phone: r.phone,
        userId: r.user_id,
        status: r.status,
      })),
    };
  });

export const listIncidentsAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql`
      select i.id, i.category_id, i.location_id, i.severity, i.status, i.description,
             i.created_at, i.user_id, p.name as reporter_name
      from incidents i
      left join profiles p on p.user_id = i.user_id
      order by i.created_at desc
      limit 300
    `;
    return (
      rows as {
        id: string;
        category_id: string;
        location_id: string | null;
        severity: Severity;
        status: string;
        description: string;
        created_at: unknown;
        user_id: string;
        reporter_name: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      categoryName: catName(r.category_id),
      locationId: r.location_id,
      locationName: r.location_id ? locName(r.location_id) : "Dropped pin",
      severity: r.severity,
      status: r.status,
      description: r.description,
      createdAt: iso(r.created_at),
      userId: r.user_id,
      reporterName: r.user_id === "seed-campus" ? "Campus archive" : (r.reporter_name ?? "Member"),
    }));
  });

export const listAnonymousAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql`
      select id, tracking_code, category_id, location_id, role, time_range,
             description, severity, status, created_at
      from anonymous_reports
      order by created_at desc
      limit 80
    `;
    return (
      rows as {
        id: string;
        tracking_code: string;
        category_id: string;
        location_id: string;
        role: string;
        time_range: string;
        description: string;
        severity: Severity;
        status: string;
        created_at: unknown;
      }[]
    ).map((r) => ({
      id: r.id,
      trackingCode: r.tracking_code,
      categoryId: r.category_id,
      categoryName: catName(r.category_id),
      locationId: r.location_id,
      locationName: locName(r.location_id),
      role: r.role,
      timeRange: r.time_range,
      description: r.description,
      severity: r.severity,
      status: r.status,
      createdAt: iso(r.created_at),
    }));
  });

export const listResponders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      unit: string;
      phone: string | null;
      user_id: string | null;
      status: Responder["status"];
    }>`select id, name, unit, phone, user_id, status from responders order by unit`;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      phone: r.phone,
      userId: r.user_id,
      status: r.status,
    }));
  });

export { fetchSos };
