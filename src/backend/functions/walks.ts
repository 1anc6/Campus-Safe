import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import { audit } from "@/backend/core/helpers";
import { CAMPUS } from "@/lib/campus";
import { iso, newId } from "@/lib/utils";
import { openSosForUser } from "./sos";

/**
 * "Walk with me" — a watchdog timer for walking somewhere alone.
 *
 * The student sets a destination and a time limit. If they don't tap
 * "I'm safe" before the deadline, the phone asks "Are you safe?" for 30 s and
 * then raises an SOS. If the phone is dead or offline, the server-side
 * watchdog (`escalateOverdueWalks`) raises it instead once the walk is more
 * than GRACE overdue — so a missed check-in is never silently dropped.
 */

export type SafeWalk = {
  id: string;
  destination: string;
  status: "active" | "completed" | "escalated" | "cancelled";
  startedAt: string;
  dueAt: string;
  endedAt: string | null;
  sosId: string | null;
};

type WalkRow = {
  id: string;
  user_id: string;
  destination: string;
  status: SafeWalk["status"];
  started_at: unknown;
  due_at: unknown;
  ended_at: unknown;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  sos_id: string | null;
};

/** Server waits this long past the deadline before escalating on its own. */
const SERVER_GRACE_MS = 2 * 60_000;
const MAX_TOTAL_MINUTES = 180;

function mapWalk(r: WalkRow): SafeWalk {
  return {
    id: r.id,
    destination: r.destination,
    status: r.status,
    startedAt: iso(r.started_at),
    dueAt: iso(r.due_at),
    endedAt: r.ended_at ? iso(r.ended_at) : null,
    sosId: r.sos_id,
  };
}

const fixSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    acc: z
      .number()
      .min(0)
      .max(100_000)
      .nullable()
      .transform((v) => (v == null ? null : Math.round(v))),
  })
  .nullable();

async function activeWalk(userId: string): Promise<WalkRow | null> {
  const sql = await getSql();
  const rows = await sql<WalkRow>`
    select * from safe_walks where user_id = ${userId} and status = 'active' limit 1
  `;
  return rows[0] ?? null;
}

/** Escalate one walk into an SOS (idempotent: only an active walk escalates). */
async function escalate(walk: WalkRow, fix?: { lat: number; lng: number; acc: number | null }) {
  const sql = await getSql();
  const claimed = await sql<{ id: string }>`
    update safe_walks set status = 'escalated', ended_at = now()
    where id = ${walk.id} and status = 'active'
    returning id
  `;
  if (!claimed[0]) return null; // already handled (client and watchdog raced)
  const position =
    fix ??
    (walk.lat != null && walk.lng != null
      ? { lat: walk.lat, lng: walk.lng, acc: walk.accuracy_m }
      : null);
  const alert = await openSosForUser(
    walk.user_id,
    position
      ? { ...position, approx: false }
      : { lat: CAMPUS.center.lat, lng: CAMPUS.center.lng, acc: null, approx: true },
    `missed safe-walk check-in (heading to ${walk.destination})`,
  );
  await sql`update safe_walks set sos_id = ${alert.id} where id = ${walk.id}`;
  return alert;
}

/**
 * Server-side watchdog: escalate every walk that is overdue past the grace
 * period. Triggered by ordinary traffic (admin counters, students' alert
 * checks, page navigation) and by the /api/cron/walks backstop; throttled to
 * once per 15 s per server instance, and a single indexed query when idle.
 */
const watchdog = globalThis as typeof globalThis & { __walkWatchdogAt__?: number };
export async function escalateOverdueWalks({ force = false } = {}): Promise<number> {
  const now = Date.now();
  if (!force && watchdog.__walkWatchdogAt__ && now - watchdog.__walkWatchdogAt__ < 15_000) return 0;
  watchdog.__walkWatchdogAt__ = now;
  const sql = await getSql();
  const overdue = await sql<WalkRow>`
    select * from safe_walks
    where status = 'active'
      and due_at < now() - ${`${SERVER_GRACE_MS} milliseconds`}::interval
    order by due_at asc
    limit 50
  `;
  let n = 0;
  for (const walk of overdue) {
    if (await escalate(walk)) n += 1;
  }
  return n;
}

/** The student's current walk — or one that escalated in the last 15 minutes. */
export const getMyWalk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SafeWalk | null> => {
    const sql = await getSql();
    const rows = await sql<WalkRow>`
      select * from safe_walks
      where user_id = ${context.userId}
        and (status = 'active' or (status = 'escalated' and ended_at > now() - interval '15 minutes'))
      order by started_at desc limit 1
    `;
    return rows[0] ? mapWalk(rows[0]) : null;
  });

export const startWalk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      destination: z.string().trim().min(2, "Where are you heading?").max(80),
      minutes: z.number().int().min(1).max(120),
      fix: fixSchema,
    }),
  )
  .handler(async ({ context, data }): Promise<SafeWalk> => {
    const existing = await activeWalk(context.userId);
    if (existing) return mapWalk(existing);
    const sql = await getSql();
    const id = newId();
    const rows = await sql<WalkRow>`
      insert into safe_walks (id, user_id, destination, due_at, lat, lng, accuracy_m, last_ping_at)
      values (
        ${id}, ${context.userId}, ${data.destination},
        now() + ${`${data.minutes} minutes`}::interval,
        ${data.fix?.lat ?? null}, ${data.fix?.lng ?? null}, ${data.fix?.acc ?? null},
        ${data.fix ? new Date().toISOString() : null}
      )
      returning *
    `;
    await audit(
      context.userId,
      "walk.start",
      "walk",
      id,
      `${data.minutes} min to ${data.destination}`,
    );
    return mapWalk(rows[0]!);
  });

export const extendWalk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64), minutes: z.number().int().min(1).max(30) }))
  .handler(async ({ context, data }): Promise<SafeWalk> => {
    const sql = await getSql();
    const rows = await sql<WalkRow>`
      update safe_walks
      set due_at = least(
        greatest(due_at, now()) + ${`${data.minutes} minutes`}::interval,
        started_at + ${`${MAX_TOTAL_MINUTES} minutes`}::interval
      )
      where id = ${data.id} and user_id = ${context.userId} and status = 'active'
      returning *
    `;
    if (!rows[0]) throw new Error("This walk has already ended.");
    return mapWalk(rows[0]);
  });

/** "I'm safe" (completed) or "Cancel walk" (cancelled). */
export const endWalk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64), outcome: z.enum(["completed", "cancelled"]) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update safe_walks set status = ${data.outcome}, ended_at = now()
      where id = ${data.id} and user_id = ${context.userId} and status = 'active'
      returning id
    `;
    if (rows[0]) await audit(context.userId, `walk.${data.outcome}`, "walk", data.id);
    return { ok: Boolean(rows[0]) };
  });

/** Keep the walk's last known position fresh (used if it escalates). */
export const pingWalk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64), fix: fixSchema.unwrap() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update safe_walks
      set lat = ${data.fix.lat}, lng = ${data.fix.lng}, accuracy_m = ${data.fix.acc}, last_ping_at = now()
      where id = ${data.id} and user_id = ${context.userId} and status = 'active'
        and (last_ping_at is null or last_ping_at < now() - interval '10 seconds')
    `;
    return { ok: true };
  });

/** The phone's "Are you safe?" countdown ran out: raise the SOS now. */
export const escalateMyWalk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(64), fix: fixSchema }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<WalkRow>`
      select * from safe_walks where id = ${data.id} and user_id = ${context.userId}
    `;
    const walk = rows[0];
    if (!walk) throw new Error("Not found");
    if (walk.status === "escalated" && walk.sos_id) return { sosId: walk.sos_id };
    const alert = await escalate(walk, data.fix ?? undefined);
    if (!alert) {
      const again = await sql<{
        sos_id: string | null;
      }>`select sos_id from safe_walks where id = ${walk.id}`;
      return { sosId: again[0]?.sos_id ?? null };
    }
    return { sosId: alert.id };
  });
