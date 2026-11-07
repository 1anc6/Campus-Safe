import { getSql } from "@/backend/db";
import { getOrCreateProfile } from "@/backend/core/helpers";
import {
  LIVE_PING_MS,
  advanceCursor,
  canSeeLiveEvent,
  formatSse,
  newCursor,
  readFrom,
  resumePoint,
  type LiveCursor,
  type LiveKind,
  type LiveRow,
  type LiveViewer,
} from "@/lib/live";
import { escalateOverdueWalks } from "@/backend/functions/walks";

/**
 * Server side of real-time updates (rules in `src/lib/live.ts`).
 *
 * One reader loop per server instance (the "hub") tails `live_events` about
 * once a second while at least one stream is open, and fans each new row out
 * to the streams whose viewer may see it. N open screens therefore cost one
 * tiny indexed query per second, not N. On Vercel each warm instance runs its
 * own hub; locally the dev server is one instance.
 */

/** How often the hub reads the log. Sets the worst-case delay before a screen hears of a change. */
const TICK_MS = 1000;
/**
 * Each stream closes after this and the browser reconnects at once, resuming
 * from its `Last-Event-ID`. Keeps every request well inside Vercel's function
 * time limit, and re-checks the session and role on every reconnect.
 */
const STREAM_LIFETIME_MS = 25_000;
/** Browser reconnect delay after the server closes a stream (SSE `retry:`). */
const RECONNECT_MS = 500;
/** Rows older than this are deleted; nothing reads them after a reconnect window. */
const KEEP_EVENTS = "1 hour";
const PRUNE_EVERY_MS = 10 * 60_000;

type Subscriber = {
  viewer: LiveViewer;
  deliver: (rows: LiveRow[], cursor: number) => void;
};

type Hub = {
  subs: Set<Subscriber>;
  cursor: LiveCursor | null;
  init: Promise<LiveCursor> | null;
  timer: ReturnType<typeof setTimeout> | null;
  lastPruneAt: number;
};

// On globalThis so dev HMR module copies share one hub (same pattern as db.ts).
const g = globalThis as typeof globalThis & { __liveHub__?: Hub };
const hub: Hub = (g.__liveHub__ ??= {
  subs: new Set(),
  cursor: null,
  init: null,
  timer: null,
  lastPruneAt: 0,
});

type Row = {
  id: number;
  kind: LiveKind;
  subject_id: string;
  owner_id: string | null;
  responder_id: string | null;
};

const mapRow = (r: Row): LiveRow => ({
  id: Number(r.id),
  kind: r.kind,
  subjectId: r.subject_id,
  ownerId: r.owner_id,
  responderId: r.responder_id,
});

async function logBounds(): Promise<{ oldest: number | null; newest: number }> {
  const sql = await getSql();
  const rows = await sql<{ oldest: number | null; newest: number | null }>`
    select min(id) as oldest, max(id) as newest from live_events
  `;
  return { oldest: rows[0]?.oldest ?? null, newest: rows[0]?.newest ?? 0 };
}

function hubCursor(): Promise<LiveCursor> {
  if (hub.cursor) return Promise.resolve(hub.cursor);
  hub.init ??= logBounds()
    .then(({ newest }) => (hub.cursor = newCursor(newest)))
    .finally(() => {
      hub.init = null;
    });
  return hub.init;
}

async function tick() {
  const cursor = await hubCursor();
  const sql = await getSql();
  const rows = await sql<Row>`
    select id, kind, subject_id, owner_id, responder_id from live_events
    where id > ${readFrom(cursor)} order by id limit 500
  `;
  const fresh = new Set(
    advanceCursor(
      cursor,
      rows.map((r) => Number(r.id)),
      Date.now(),
    ),
  );
  const out = rows.filter((r) => fresh.has(Number(r.id))).map(mapRow);
  for (const sub of hub.subs) sub.deliver(out, cursor.last);

  // The safe-walk watchdog used to ride on the admin console's 8-second poll.
  // With polling gone an open console drives it from here instead (it
  // throttles itself to every 15 s; an external cron covers closed consoles).
  if ([...hub.subs].some((s) => s.viewer.role === "admin")) {
    await escalateOverdueWalks().catch((err) => console.error("[walks] watchdog failed:", err));
  }

  if (Date.now() - hub.lastPruneAt > PRUNE_EVERY_MS) {
    hub.lastPruneAt = Date.now();
    // Always keep the newest row so the next stream's starting id stays right.
    await sql`
      delete from live_events
      where created_at < now() - ${KEEP_EVENTS}::interval
        and id < (select max(id) from live_events)
    `;
  }
}

function schedule() {
  if (hub.timer || hub.subs.size === 0) return;
  hub.timer = setTimeout(() => {
    void tick()
      .catch((err) => console.error("[live] read failed:", err))
      .finally(() => {
        hub.timer = null;
        schedule();
      });
  }, TICK_MS);
}

/** The caller as the live stream sees them (same inputs as `loadIncidentViewer`). */
export async function loadLiveViewer(userId: string): Promise<LiveViewer> {
  const profile = await getOrCreateProfile(userId);
  if (profile.role === "student") return { userId, role: "student", responderIds: [] };
  const sql = await getSql();
  const units = await sql<{ id: string }>`select id from responders where user_id = ${userId}`;
  return { userId, role: profile.role, responderIds: units.map((u) => u.id) };
}

/**
 * The body of one `/api/live` response: `ready`, then `change` events the
 * viewer may see, a `ping` every 10 s, and a clean close after 25 s.
 */
export function openLiveStream(
  viewer: LiveViewer,
  lastEventId: string | null,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let sentId = -1;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };
      const send = (rows: LiveRow[], cursor: number) => {
        const visible = rows.filter((r) => canSeeLiveEvent(viewer, r));
        visible.forEach((r, i) => {
          // Only the last message of a batch carries the id, so a reconnect
          // resumes after the whole batch.
          const id = i === visible.length - 1 && cursor !== sentId ? cursor : undefined;
          if (id !== undefined) sentId = id;
          write(formatSse({ event: "change", id, data: { kind: r.kind, id: r.subjectId } }));
        });
      };
      const sub: Subscriber = { viewer, deliver: send };

      const ping = setInterval(() => {
        const cursor = hub.cursor?.last;
        const id = cursor !== undefined && cursor !== sentId ? cursor : undefined;
        if (id !== undefined) sentId = id;
        write(formatSse({ event: "ping", id }));
      }, LIVE_PING_MS);
      const lifetime = setTimeout(() => stop(), STREAM_LIFETIME_MS);

      function stop() {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearTimeout(lifetime);
        hub.subs.delete(sub);
        signal.removeEventListener("abort", stop);
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      }
      cleanup = stop;
      signal.addEventListener("abort", stop);

      try {
        const cursor = await hubCursor();
        const upTo = cursor.last;
        const start = resumePoint(lastEventId, await logBounds());
        sentId = upTo;
        write(
          formatSse({
            retry: RECONNECT_MS,
            event: "ready",
            id: upTo,
            data: { resync: start.resync },
          }),
        );
        if (closed) return;
        hub.subs.add(sub);
        schedule();
        // Catch up on what happened while this browser was reconnecting.
        if (!start.resync && start.from < upTo) {
          const sql = await getSql();
          const missed = await sql<Row>`
            select id, kind, subject_id, owner_id, responder_id from live_events
            where id > ${start.from} and id <= ${upTo} order by id limit 500
          `;
          send(missed.map(mapRow), upTo);
        }
      } catch (err) {
        console.error("[live] stream failed to start:", err);
        stop();
      }
    },
    cancel() {
      cleanup();
    },
  });
}
