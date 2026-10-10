import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import { audit, requireAdmin } from "@/backend/core/helpers";
import { iso, newId } from "@/lib/utils";
import { escalateOverdueWalks } from "./walks";

/**
 * Campus-wide broadcasts: command posts an alert ("Avoid Gate 2 — fire drill"),
 * every student sees a banner until they tap "Got it", and command sees how many
 * have seen it. Acknowledgements are one row per (alert, student).
 */

export type AlertLevel = "info" | "warning" | "critical";

export type CampusAlert = {
  id: string;
  title: string;
  body: string;
  level: AlertLevel;
  createdAt: string;
  expiresAt: string | null;
  endedAt: string | null;
};

export type CampusAlertAdmin = CampusAlert & {
  createdByName: string;
  live: boolean;
  seenCount: number;
};

type AlertRow = {
  id: string;
  title: string;
  body: string;
  level: AlertLevel;
  created_at: unknown;
  expires_at: unknown;
  ended_at: unknown;
};

function mapAlert(r: AlertRow): CampusAlert {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    level: r.level,
    createdAt: iso(r.created_at),
    expiresAt: r.expires_at ? iso(r.expires_at) : null,
    endedAt: r.ended_at ? iso(r.ended_at) : null,
  };
}

/** SQL condition for "still showing": not ended and not expired. */
const LIVE = `a.ended_at is null and (a.expires_at is null or a.expires_at > now())`;

export const createCampusAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(3, "Add a short title").max(80),
      body: z.string().trim().min(3, "Add the message").max(500),
      level: z.enum(["info", "warning", "critical"]),
      /** How long it shows; null = until an admin ends it. */
      hours: z.number().int().min(1).max(168).nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const id = newId();
    await sql`
      insert into campus_alerts (id, title, body, level, created_by, expires_at)
      values (
        ${id}, ${data.title}, ${data.body}, ${data.level}, ${context.userId},
        ${data.hours ? new Date(Date.now() + data.hours * 3_600_000).toISOString() : null}
      )
    `;
    await audit(context.userId, "alert.create", "alert", id, data.level);
    return { id };
  });

export const endCampusAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`update campus_alerts set ended_at = now() where id = ${data.id} and ended_at is null`;
    await audit(context.userId, "alert.end", "alert", data.id);
    return { ok: true };
  });

/** Recent broadcasts with how many students have seen each. */
export const listCampusAlertsAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<
      AlertRow & { created_by_name: string | null; live: boolean; seen_count: number }
    >(
      `select a.*, p.name as created_by_name, (${LIVE}) as live,
              (select count(*)::int from alert_acks k where k.alert_id = a.id) as seen_count
       from campus_alerts a
       left join profiles p on p.user_id = a.created_by
       order by a.created_at desc
       limit 30`,
    );
    const students = await sql<{
      n: number;
    }>`select count(*)::int as n from profiles where role = 'student'`;
    return {
      students: students[0]?.n ?? 0,
      alerts: rows.map((r): CampusAlertAdmin => ({
        ...mapAlert(r),
        createdByName: r.created_by_name ?? "Command",
        live: Boolean(r.live),
        seenCount: r.seen_count,
      })),
    };
  });

/** Live alerts this person hasn't acknowledged yet (newest first). */
export const getMyCampusAlerts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CampusAlert[]> => {
    // Every student polls this — a natural heartbeat for the safe-walk watchdog.
    await escalateOverdueWalks().catch((err) => console.error("[walks] watchdog failed:", err));
    const sql = await getSql();
    const rows = await sql.query<AlertRow>(
      `select a.* from campus_alerts a
       where ${LIVE}
         and not exists (select 1 from alert_acks k where k.alert_id = a.id and k.user_id = $1)
       order by case a.level when 'critical' then 0 when 'warning' then 1 else 2 end, a.created_at desc
       limit 5`,
      [context.userId],
    );
    return rows.map(mapAlert);
  });

export const ackCampusAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into alert_acks (alert_id, user_id) values (${data.id}, ${context.userId})
      on conflict (alert_id, user_id) do nothing
    `;
    return { ok: true };
  });
