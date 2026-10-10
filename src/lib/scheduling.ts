/**
 * Scheduling rules for campus command — the Operating-System ideas behind the
 * live queue and responder assignment. Pure functions (no I/O) so they run the
 * same on the server and in the browser, and are unit-tested in
 * `scheduling.test.ts`.
 */

export type Severity = "P1" | "P2" | "P3" | "P4";

/* ------------------------------------------------------------------ */
/* 1. Priority scheduling with AGING                                    */
/* ------------------------------------------------------------------ */

/**
 * Every this many minutes of waiting, an open case climbs one severity level.
 * Without aging, a steady stream of P1s would leave a P4 waiting forever
 * (starvation). With it, a P4 is treated like a P1 after 90 minutes.
 */
export const AGING_STEP_MIN = 30;

const SEVERITY_LEVEL: Record<Severity, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
const LEVEL_SEVERITY: Severity[] = ["P1", "P2", "P3", "P4"];

/** Severity after aging: 0 = P1 (highest) … 3 = P4. Never goes above P1. */
export function agedLevel(severity: Severity, startedAt: string | number, now: number): number {
  const waitedMin = Math.max(0, (now - +new Date(startedAt)) / 60_000);
  const boost = Math.floor(waitedMin / AGING_STEP_MIN);
  return Math.max(0, SEVERITY_LEVEL[severity] - boost);
}

/** The severity a case is currently scheduled at (e.g. a P4 that has aged to "P2"). */
export function agedSeverity(
  severity: Severity,
  startedAt: string | number,
  now: number,
): Severity {
  return LEVEL_SEVERITY[agedLevel(severity, startedAt, now)];
}

export type SchedulableItem = {
  kind: "sos" | "incident" | "anonymous";
  severity: Severity;
  startedAt: string;
};

/**
 * Comparator for the live queue — three keys, like a multilevel scheduler:
 *   1. SOS alerts always first (a person in danger right now).
 *   2. Then by AGED severity (P1 before P2 …, with waiting time boosting priority).
 *   3. Ties: first come, first served (FCFS) — the oldest case first.
 */
export function compareQueueItems(now: number) {
  return (a: SchedulableItem, b: SchedulableItem): number => {
    const kindRank = (k: SchedulableItem["kind"]) => (k === "sos" ? 0 : 1);
    const byKind = kindRank(a.kind) - kindRank(b.kind);
    if (byKind) return byKind;
    const byLevel =
      agedLevel(a.severity, a.startedAt, now) - agedLevel(b.severity, b.startedAt, now);
    if (byLevel) return byLevel;
    return +new Date(a.startedAt) - +new Date(b.startedAt);
  };
}

/* ------------------------------------------------------------------ */
/* 2. Counting semaphore + load-balanced responder selection             */
/* ------------------------------------------------------------------ */

/**
 * Each responder unit can hold at most this many live SOS alerts at once.
 * This is the initial value of a counting semaphore per responder: assigning
 * an alert is P() (wait/acquire a slot), resolving it is V() (signal/release).
 * The database enforces it atomically — see `acquireResponderSlot` in
 * `backend/functions/sos.ts`.
 */
export const MAX_ACTIVE_SOS_PER_RESPONDER = 2;

export type ResponderLoad = {
  id: string;
  status: "available" | "on_duty" | "off_duty";
  /** Semaphore count: live SOS alerts currently held by this unit. */
  activeSos: number;
  /** When this unit was last given an alert (null = never). */
  lastAssignedAt: string | null;
};

/** True when the unit has a free slot and is not off duty. */
export function hasFreeSlot(r: ResponderLoad): boolean {
  return r.status !== "off_duty" && r.activeSos < MAX_ACTIVE_SOS_PER_RESPONDER;
}

/**
 * Pick the responder to suggest for a new SOS (load balancing):
 *   1. Skip units that are off duty or full (semaphore at 0 free slots).
 *   2. Least-loaded first — fewest live alerts.
 *   3. Ties: round-robin — the unit that has waited longest since its last
 *      assignment goes next (a unit never assigned goes first).
 * Returns null when every unit is busy, so command knows to wait or override.
 */
export function pickResponder<T extends ResponderLoad>(responders: readonly T[]): T | null {
  const lastAt = (r: ResponderLoad) => (r.lastAssignedAt ? +new Date(r.lastAssignedAt) : -Infinity);
  const ready = responders.filter(hasFreeSlot);
  ready.sort((a, b) => a.activeSos - b.activeSos || lastAt(a) - lastAt(b));
  return ready[0] ?? null;
}
