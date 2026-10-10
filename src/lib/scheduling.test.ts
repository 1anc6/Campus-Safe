import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGING_STEP_MIN,
  MAX_ACTIVE_SOS_PER_RESPONDER,
  agedSeverity,
  compareQueueItems,
  pickResponder,
  type ResponderLoad,
  type SchedulableItem,
} from "./scheduling.ts";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("aging", () => {
  it("keeps a fresh case at its own severity", () => {
    assert.equal(agedSeverity("P4", minsAgo(5), NOW), "P4");
  });

  it("raises one level per step waited", () => {
    assert.equal(agedSeverity("P4", minsAgo(AGING_STEP_MIN), NOW), "P3");
    assert.equal(agedSeverity("P4", minsAgo(AGING_STEP_MIN * 2), NOW), "P2");
  });

  it("never goes above P1", () => {
    assert.equal(agedSeverity("P3", minsAgo(AGING_STEP_MIN * 10), NOW), "P1");
  });
});

describe("compareQueueItems", () => {
  const sort = (items: SchedulableItem[]) => [...items].sort(compareQueueItems(NOW));

  it("always puts SOS first", () => {
    const out = sort([
      { kind: "incident", severity: "P1", startedAt: minsAgo(60) },
      { kind: "sos", severity: "P1", startedAt: minsAgo(1) },
    ]);
    assert.equal(out[0].kind, "sos");
  });

  it("orders by severity, then first come first served", () => {
    const out = sort([
      { kind: "incident", severity: "P2", startedAt: minsAgo(2) },
      { kind: "incident", severity: "P1", startedAt: minsAgo(1) },
      { kind: "anonymous", severity: "P2", startedAt: minsAgo(4) },
    ]);
    assert.deepEqual(
      out.map((i) => `${i.severity}@${i.kind}`),
      ["P1@incident", "P2@anonymous", "P2@incident"],
    );
  });

  it("prevents starvation: a long-waiting P4 overtakes a new P2", () => {
    const old = {
      kind: "incident",
      severity: "P4",
      startedAt: minsAgo(AGING_STEP_MIN * 3),
    } as const;
    const fresh = { kind: "incident", severity: "P2", startedAt: minsAgo(1) } as const;
    assert.equal(sort([fresh, old])[0], old);
  });
});

describe("pickResponder", () => {
  const unit = (
    id: string,
    activeSos: number,
    lastAssignedAt: string | null = null,
    status: ResponderLoad["status"] = "available",
  ): ResponderLoad => ({
    id,
    status,
    activeSos,
    lastAssignedAt,
  });

  it("picks the least-loaded unit", () => {
    assert.equal(pickResponder([unit("a", 1), unit("b", 0)])?.id, "b");
  });

  it("breaks ties round-robin: longest since last assignment goes next", () => {
    const picked = pickResponder([
      unit("a", 0, minsAgo(5)),
      unit("b", 0, minsAgo(50)),
      unit("c", 0, minsAgo(20)),
    ]);
    assert.equal(picked?.id, "b");
  });

  it("prefers a never-assigned unit on a tie", () => {
    assert.equal(pickResponder([unit("a", 0, minsAgo(90)), unit("b", 0, null)])?.id, "b");
  });

  it("skips full and off-duty units, and returns null when all are busy", () => {
    const full = unit("full", MAX_ACTIVE_SOS_PER_RESPONDER);
    const off = unit("off", 0, null, "off_duty");
    assert.equal(pickResponder([full, off, unit("ok", 1)])?.id, "ok");
    assert.equal(pickResponder([full, off]), null);
  });
});
