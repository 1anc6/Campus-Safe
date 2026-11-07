import type { UserRole } from "./campus";

/**
 * Real-time updates — the pure rules, shared by the `/api/live` stream (server)
 * and the `useLiveUpdates` hook (browser), and unit-tested in `live.test.ts`.
 *
 * How it fits together:
 *   1. Database triggers (migration 0013) append a row to `live_events` whenever
 *      an SOS, GPS point, incident, anonymous report, thread message, campus
 *      broadcast or responder unit changes.
 *   2. `/api/live` is a Server-Sent Events stream. One loop per server instance
 *      reads new rows about once a second and sends each open stream only the
 *      events its viewer may see (`canSeeLiveEvent`).
 *   3. An event carries just `{ kind, id }`. The screen re-fetches through its
 *      usual server function, which checks access again — so the stream never
 *      carries case data, and the existing rules stay the single source of truth.
 *   4. If the stream drops or never connects, screens fall back to polling.
 */

export const LIVE_KINDS = [
  "sos",
  "incident",
  "anonymous",
  "alert",
  "alert_ack",
  "responder",
] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/** What the browser receives: "this case changed, fetch it again". */
export type LiveEvent = { kind: LiveKind; id: string };

/** One `live_events` row as the server reads it. */
export type LiveRow = {
  id: number;
  kind: LiveKind;
  subjectId: string;
  /** The student the case belongs to, if any. */
  ownerId: string | null;
  /** The responder unit working the case (or the unit itself, for `responder`). */
  responderId: string | null;
};

/** The stream's viewer: role plus the responder units they staff. */
export type LiveViewer = {
  userId: string;
  role: UserRole;
  responderIds: readonly string[];
};

/**
 * Who hears about a change — mirrors the server functions' own rules:
 *   admin     — everything (command sees every case).
 *   responder — SOS alerts and incidents assigned to their unit, and their unit itself
 *               (`getSos` / `listAssignedSos` / `incidentAccess`).
 *   student   — their own SOS alerts and incidents (`getSos`, `getIncident`).
 *   everyone  — campus broadcasts (`getMyCampusAlerts`).
 * Anonymous reports and broadcast acknowledgements are command-only.
 */
export function canSeeLiveEvent(viewer: LiveViewer, row: LiveRow): boolean {
  if (viewer.role === "admin") return true;
  if (row.kind === "alert") return true;
  if (row.kind === "anonymous" || row.kind === "alert_ack") return false;
  if (viewer.role === "responder") {
    if (row.responderId !== null && viewer.responderIds.includes(row.responderId)) return true;
  }
  if (row.kind === "responder") return false;
  return row.ownerId !== null && row.ownerId === viewer.userId;
}

// ---------------------------------------------------------------------------
// Reading the log in order.

/**
 * Where the stream has read up to. `bigserial` ids are handed out when a row is
 * inserted but become visible when its transaction commits, so a smaller id can
 * appear after a larger one. Ids skipped over are kept as `gaps` for a few
 * seconds and read again, so a late commit is still delivered (once); after
 * that they are dropped (a rolled-back insert leaves a permanent hole).
 */
export type LiveCursor = {
  /** Highest id read so far. */
  last: number;
  /** Missing ids below `last` → when they were first noticed missing (ms). */
  gaps: Map<number, number>;
};

export const GAP_WAIT_MS = 5000;
/** A burst bigger than this (e.g. a sequence jump after a restart) isn't tracked id by id. */
const MAX_GAPS = 200;

export function newCursor(last: number): LiveCursor {
  return { last, gaps: new Map() };
}

/** The id to read after (`where id > from`): low enough to re-check open gaps. */
export function readFrom(cursor: LiveCursor): number {
  let from = cursor.last;
  for (const id of cursor.gaps.keys()) if (id - 1 < from) from = id - 1;
  return from;
}

/**
 * Feed the ids a read returned (any order). Returns the ids not delivered
 * before, in ascending order, and moves the cursor forward.
 */
export function advanceCursor(cursor: LiveCursor, ids: readonly number[], now: number): number[] {
  const fresh: number[] = [];
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  for (const id of sorted) {
    if (id > cursor.last) {
      if (cursor.gaps.size < MAX_GAPS) {
        for (let missing = cursor.last + 1; missing < id; missing += 1) {
          if (cursor.gaps.size >= MAX_GAPS) break;
          cursor.gaps.set(missing, now);
        }
      }
      cursor.last = id;
      fresh.push(id);
    } else if (cursor.gaps.delete(id)) {
      fresh.push(id);
    }
  }
  for (const [id, since] of cursor.gaps) {
    if (now - since >= GAP_WAIT_MS) cursor.gaps.delete(id);
  }
  return fresh.sort((a, b) => a - b);
}

/**
 * Where a (re)connecting stream starts. A browser that reconnects sends the
 * last id it saw (`Last-Event-ID`); if that is still inside the kept log it
 * resumes there with nothing missed. Otherwise it starts at the newest row, and
 * `resync` tells the screens to reload once, since changes may have been missed.
 */
export function resumePoint(
  lastEventId: string | null | undefined,
  log: { oldest: number | null; newest: number },
): { from: number; resync: boolean } {
  const n = lastEventId && /^\d{1,15}$/.test(lastEventId.trim()) ? Number(lastEventId) : null;
  if (n === null) return { from: log.newest, resync: false };
  if (n > log.newest) return { from: log.newest, resync: true }; // log was reset (local dev restart)
  // Everything after n is still kept when the oldest kept row is n+1 or earlier
  // (an empty log since n means nothing happened).
  if (log.oldest === null || log.oldest <= n + 1) return { from: n, resync: false };
  return { from: log.newest, resync: true };
}

// ---------------------------------------------------------------------------
// Wire format (text/event-stream).

/** One Server-Sent Events message. `data` is JSON-encoded on a single line. */
export function formatSse(msg: { event?: string; id?: number; data?: unknown; retry?: number }) {
  let out = "";
  if (msg.retry !== undefined) out += `retry: ${msg.retry}\n`;
  if (msg.id !== undefined) out += `id: ${msg.id}\n`;
  if (msg.event) out += `event: ${msg.event}\n`;
  out += `data: ${msg.data === undefined ? "" : JSON.stringify(msg.data)}\n\n`;
  return out;
}

/** Validate a `change` event's data in the browser; anything unexpected is ignored. */
export function parseLiveEvent(data: string): LiveEvent | null {
  try {
    const v = JSON.parse(data) as unknown;
    if (!v || typeof v !== "object") return null;
    const { kind, id } = v as Record<string, unknown>;
    if (typeof id !== "string" || !id) return null;
    if (typeof kind !== "string" || !(LIVE_KINDS as readonly string[]).includes(kind)) return null;
    return { kind: kind as LiveKind, id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Browser-side decisions.

/** What a screen listens for: some kinds, optionally one case id. */
export type LiveFilter = { kinds: readonly LiveKind[]; id?: string };

export function matchesLiveFilter(ev: LiveEvent, filter: LiveFilter): boolean {
  if (!filter.kinds.includes(ev.kind)) return false;
  return filter.id === undefined || filter.id === ev.id;
}

/** The server sends a `ping` this often; a stream silent for 2.5× that is treated as down. */
export const LIVE_PING_MS = 10_000;
export const LIVE_STALE_MS = 25_000;

/**
 * Is the stream trustworthy right now? Not given up on, and heard from
 * recently. The short reconnect every 25 s still counts as healthy: the
 * browser resumes from its last id, so nothing is missed. A proxy that
 * buffers the response delivers pings late in bursts, so it reads as stale and
 * the screen keeps polling — never worse than before.
 */
export function streamHealthy(
  state: { closed: boolean; lastMessageAt: number | null },
  now: number,
): boolean {
  return !state.closed && state.lastMessageAt !== null && now - state.lastMessageAt < LIVE_STALE_MS;
}

/**
 * Throttle for refreshes: run at once if the last run was at least `gapMs` ago,
 * otherwise wait the remainder (a burst of GPS points becomes one refresh).
 */
export function refreshDelay(lastRunAt: number | null, now: number, gapMs: number): number {
  if (lastRunAt === null) return 0;
  return Math.max(0, gapMs - (now - lastRunAt));
}
