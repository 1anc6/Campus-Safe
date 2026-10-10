import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type {
  BloodGroup,
  MedicalInfo,
  Profile,
  SosAlert,
  SosPoint,
  ThreadMessage,
} from "@/lib/types";
import { iso, newId } from "@/lib/utils";
import { z } from "zod";
import { addSystemMessage, audit, getOrCreateProfile, requireAdmin, requireStaff } from "./helpers";

type SosRow = {
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
  reporter_phone: string | null;
  reporter_avatar: string | null;
  reporter_blood_group: string | null;
  reporter_emergency_name: string | null;
  reporter_emergency_phone: string | null;
  reporter_medical_notes: string | null;
  reporter_share_medical: boolean | null;
  assigned_name: string | null;
  assigned_phone: string | null;
};

/** The reporter's medical ID, only when they chose to share it and filled something in. */
function mapMedical(row: SosRow): MedicalInfo | null {
  if (row.reporter_share_medical === false) return null;
  // Students are promised responders see it "only while your SOS is open".
  if (row.status === "resolved" || row.status === "cancelled") return null;
  const info: MedicalInfo = {
    bloodGroup: (row.reporter_blood_group as BloodGroup | null) ?? null,
    emergencyName: row.reporter_emergency_name,
    emergencyPhone: row.reporter_emergency_phone,
    medicalNotes: row.reporter_medical_notes,
  };
  return Object.values(info).some(Boolean) ? info : null;
}

function mapSos(row: SosRow): SosAlert {
  return {
    id: row.id,
    userId: row.user_id,
    reporterName: row.reporter_name ?? "Campus member",
    reporterPhone: row.reporter_phone,
    reporterAvatar: row.reporter_avatar,
    reporterMedical: mapMedical(row),
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    isApproximate: Boolean(row.is_approximate),
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    assignedPhone: row.assigned_phone,
    notes: row.notes,
    startedAt: iso(row.started_at),
    receivedAt: row.received_at ? iso(row.received_at) : null,
    assignedAt: row.assigned_at ? iso(row.assigned_at) : null,
    arrivedAt: row.arrived_at ? iso(row.arrived_at) : null,
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
  };
}

const SOS_SELECT = `
  select s.id, s.user_id, s.status, s.lat, s.lng, s.accuracy_m, s.is_approximate,
         s.assigned_to, s.notes, s.started_at, s.received_at, s.assigned_at, s.arrived_at, s.resolved_at,
         p.name as reporter_name, p.phone as reporter_phone, p.avatar_url as reporter_avatar,
         p.blood_group as reporter_blood_group, p.emergency_name as reporter_emergency_name,
         p.emergency_phone as reporter_emergency_phone, p.medical_notes as reporter_medical_notes,
         p.share_medical as reporter_share_medical,
         r.name as assigned_name, r.phone as assigned_phone
  from sos_alerts s
  left join profiles p on p.user_id = s.user_id
  left join responders r on r.id = s.assigned_to
`;

export async function fetchSos(id: string): Promise<SosAlert | null> {
  const sql = await getSql();
  const rows = await sql.query<SosRow>(`${SOS_SELECT} where s.id = $1`, [id]);
  return rows[0] ? mapSos(rows[0]) : null;
}

/** Staff access to one alert: admins see all; responders only alerts assigned to their unit. */
async function staffCanAccessSos(profile: Profile, alert: SosAlert): Promise<boolean> {
  if (profile.role === "admin") return true;
  if (profile.role !== "responder" || !alert.assignedTo) return false;
  const sql = await getSql();
  const unit = await sql<{ id: string }>`
    select id from responders where id = ${alert.assignedTo} and user_id = ${profile.userId}
  `;
  return Boolean(unit[0]);
}

const fixSchema = {
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  acc: z.number().min(0).max(100_000).nullable(),
  approx: z.boolean(),
};

export const createSos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object(fixSchema))
  .handler(async ({ context, data }) => {
    await getOrCreateProfile(context.userId);
    const sql = await getSql();
    // One live SOS per student: a repeat press (double tap, retry after a
    // dropped connection, offline queue) returns the alert already open instead
    // of flooding command with duplicates. Never rate-limited — a real
    // emergency must always get through.
    const open = await sql<{ id: string }>`
      select id from sos_alerts
      where user_id = ${context.userId} and status not in ('resolved', 'cancelled')
      order by started_at desc limit 1
    `;
    if (open[0]) {
      await sql`
        update sos_alerts set lat = ${data.lat}, lng = ${data.lng}, accuracy_m = ${data.acc},
          is_approximate = ${data.approx}
        where id = ${open[0].id}
      `;
      return (await fetchSos(open[0].id))!;
    }
    const id = newId();
    const now = new Date().toISOString();
    await sql`
      insert into sos_alerts (
        id, user_id, status, lat, lng, accuracy_m, is_approximate, started_at, received_at
      ) values (
        ${id}, ${context.userId}, ${"sent"}, ${data.lat}, ${data.lng},
        ${data.acc}, ${data.approx}, ${now}, ${now}
      )
    `;
    await sql`
      insert into sos_locations (id, alert_id, lat, lng, accuracy_m)
      values (${newId()}, ${id}, ${data.lat}, ${data.lng}, ${data.acc})
    `;
    await addSystemMessage("sos", id, "SOS received by campus command.");
    await audit(context.userId, "sos.create", "sos", id);
    // Auto-flip to received a moment later conceptually — already set received_at.
    await sql`update sos_alerts set status = ${"received"} where id = ${id}`;
    const alert = await fetchSos(id);
    return alert!;
  });

/** Trail points closer together than this are merged (stops a runaway client filling the table). */
const MIN_PING_GAP_MS = 2000;
const MAX_TRAIL_POINTS = 5000;

export const pingSosLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64), ...fixSchema }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const own = await sql<{ id: string; status: string }>`
      select id, status from sos_alerts where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!own[0]) throw new Error("Not found");
    if (own[0].status === "resolved" || own[0].status === "cancelled") return { ok: true };
    const last = await sql<{ recent: boolean; n: number }>`
      select coalesce(max(recorded_at) > now() - ${`${MIN_PING_GAP_MS} milliseconds`}::interval, false) as recent,
             count(*)::int as n
      from sos_locations where alert_id = ${data.id}
    `;
    if (last[0]?.recent || (last[0]?.n ?? 0) >= MAX_TRAIL_POINTS) return { ok: true };
    await sql`
      update sos_alerts
      set lat = ${data.lat}, lng = ${data.lng}, accuracy_m = ${data.acc}, is_approximate = ${data.approx}
      where id = ${data.id}
    `;
    await sql`
      insert into sos_locations (id, alert_id, lat, lng, accuracy_m)
      values (${newId()}, ${data.id}, ${data.lat}, ${data.lng}, ${data.acc})
    `;
    return { ok: true };
  });

export const markSosSafe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const own = await sql<{ id: string }>`
      select id from sos_alerts where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!own[0]) throw new Error("Not found");
    const changed = await sql<{ id: string }>`
      update sos_alerts set status = ${"resolved"}, resolved_at = now()
      where id = ${data.id} and status not in ('resolved', 'cancelled')
      returning id
    `;
    if (!changed[0]) return fetchSos(data.id);
    await addSystemMessage("sos", data.id, "Reporter marked themselves safe.");
    await audit(context.userId, "sos.safe", "sos", data.id);
    return fetchSos(data.id);
  });

export const cancelSos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update sos_alerts set status = ${"cancelled"}, resolved_at = now()
      where id = ${data.id} and user_id = ${context.userId} and status in ('sent','received')
    `;
    return { ok: true };
  });

export const getSos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const alert = await fetchSos(data.id);
    if (!alert) throw new Error("Not found");
    const profile = await getOrCreateProfile(context.userId);
    if (alert.userId !== context.userId && !(await staffCanAccessSos(profile, alert))) {
      throw new Error("Forbidden");
    }
    const sql = await getSql();
    const trail = await sql<{
      id: string;
      lat: number;
      lng: number;
      accuracy_m: number | null;
      recorded_at: unknown;
    }>`select id, lat, lng, accuracy_m, recorded_at from sos_locations where alert_id = ${data.id} order by recorded_at asc`;
    const messages = await sql<{
      id: string;
      kind: ThreadMessage["kind"];
      subject_id: string;
      author_role: ThreadMessage["authorRole"];
      author_id: string | null;
      body: string;
      created_at: unknown;
    }>`select id, kind, subject_id, author_role, author_id, body, created_at from threads where kind = ${"sos"} and subject_id = ${data.id} order by created_at asc`;
    return {
      alert,
      trail: trail.map((t): SosPoint => ({
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        accuracyM: t.accuracy_m,
        recordedAt: iso(t.recorded_at),
      })),
      messages: messages.map((m): ThreadMessage => ({
        id: m.id,
        kind: m.kind,
        subjectId: m.subject_id,
        authorRole: m.author_role,
        authorId: m.author_id,
        body: m.body,
        createdAt: iso(m.created_at),
      })),
    };
  });

export const assignSos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), responderId: z.string() }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const r = await sql<{
      name: string;
    }>`select name from responders where id = ${data.responderId}`;
    if (!r[0]) throw new Error("Unknown responder");
    const updated = await sql<{ id: string }>`
      update sos_alerts
      set assigned_to = ${data.responderId}, status = ${"assigned"}, assigned_at = now()
      where id = ${data.id} and status not in ('resolved', 'cancelled')
      returning id
    `;
    if (!updated[0]) throw new Error("Alert is closed or missing");
    await addSystemMessage("sos", data.id, `${r[0]?.name ?? "Responder"} assigned.`);
    await audit(context.userId, "sos.assign", "sos", data.id, data.responderId);
    return fetchSos(data.id);
  });

export const setSosStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["assigned", "arrived", "resolved", "cancelled"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireStaff(context.userId);
    const current = await fetchSos(data.id);
    if (!current) throw new Error("Not found");
    if (!(await staffCanAccessSos(profile, current))) throw new Error("Forbidden");
    // Closed alerts are part of the record: they can't be reopened or rewritten.
    if (current.status === "resolved" || current.status === "cancelled") {
      throw new Error("This alert is already closed.");
    }
    const sql = await getSql();
    if (data.status === "arrived") {
      await sql`update sos_alerts set status = ${"arrived"}, arrived_at = now() where id = ${data.id}`;
      await addSystemMessage("sos", data.id, `${profile.name} marked arrived.`);
    } else if (data.status === "resolved") {
      await sql`update sos_alerts set status = ${"resolved"}, resolved_at = now() where id = ${data.id}`;
      await addSystemMessage("sos", data.id, "Alert resolved.");
    } else if (data.status === "cancelled") {
      await sql`update sos_alerts set status = ${"cancelled"}, resolved_at = now() where id = ${data.id}`;
    } else {
      await sql`update sos_alerts set status = ${data.status} where id = ${data.id}`;
    }
    await audit(context.userId, "sos.status", "sos", data.id, data.status);
    return fetchSos(data.id);
  });

export const listMySos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<SosRow>(
      `${SOS_SELECT} where s.user_id = $1 order by s.started_at desc limit 20`,
      [context.userId],
    );
    return rows.map(mapSos);
  });

export const listAssignedSos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await requireStaff(context.userId);
    const sql = await getSql();
    if (profile.role === "admin") {
      const rows = await sql.query<SosRow>(
        `${SOS_SELECT} where s.status not in ('resolved','cancelled') order by s.started_at desc`,
      );
      return rows.map(mapSos);
    }
    const rows = await sql.query<SosRow>(
      `${SOS_SELECT} where s.assigned_to in (select id from responders where user_id = $1) and s.status not in ('resolved','cancelled') order by s.started_at desc`,
      [context.userId],
    );
    return rows.map(mapSos);
  });
