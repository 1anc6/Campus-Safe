import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GAP_WAIT_MS,
  LIVE_STALE_MS,
  advanceCursor,
  canSeeLiveEvent,
  formatSse,
  matchesLiveFilter,
  newCursor,
  parseLiveEvent,
  readFrom,
  refreshDelay,
  resumePoint,
  streamHealthy,
  type LiveRow,
  type LiveViewer,
} from "./live.ts";

const student: LiveViewer = { userId: "stu-1", role: "student", responderIds: [] };
const otherStudent: LiveViewer = { userId: "stu-2", role: "student", responderIds: [] };
const responder: LiveViewer = { userId: "res-1", role: "responder", responderIds: ["unit-a"] };
const otherResponder: LiveViewer = { userId: "res-2", role: "responder", responderIds: ["unit-b"] };
const admin: LiveViewer = { userId: "adm-1", role: "admin", responderIds: ["self-adm-1"] };

const row = (over: Partial<LiveRow>): LiveRow => ({
  id: 1,
  kind: "sos",
  subjectId: "sos-1",
  ownerId: "stu-1",
  responderId: "unit-a",
  ...over,
});

describe("canSeeLiveEvent", () => {
  it("tells command about everything", () => {
    for (const kind of [
      "sos",
      "incident",
      "anonymous",
      "alert",
      "alert_ack",
      "responder",
    ] as const) {
      assert.equal(canSeeLiveEvent(admin, row({ kind, ownerId: null, responderId: null })), true);
    }
  });

  it("tells a student about their own SOS and reports only", () => {
    assert.equal(canSeeLiveEvent(student, row({})), true);
    assert.equal(canSeeLiveEvent(student, row({ kind: "incident" })), true);
    assert.equal(canSeeLiveEvent(otherStudent, row({})), false);
    assert.equal(canSeeLiveEvent(otherStudent, row({ kind: "incident" })), false);
  });

  it("tells a responder about cases assigned to their unit only", () => {
    assert.equal(canSeeLiveEvent(responder, row({})), true);
    assert.equal(canSeeLiveEvent(responder, row({ kind: "incident" })), true);
    assert.equal(canSeeLiveEvent(otherResponder, row({})), false);
    assert.equal(canSeeLiveEvent(responder, row({ responderId: null })), false);
  });

  it("tells a responder about their own unit but not other units", () => {
    const unit = row({ kind: "responder", subjectId: "unit-a", ownerId: null });
    assert.equal(canSeeLiveEvent(responder, unit), true);
    assert.equal(canSeeLiveEvent(otherResponder, unit), false);
    assert.equal(canSeeLiveEvent(student, unit), false);
  });

  it("keeps anonymous reports and broadcast acknowledgements command-only", () => {
    // Even a row that happened to carry an owner or unit is never leaked.
    for (const kind of ["anonymous", "alert_ack"] as const) {
      const r = row({ kind, ownerId: "stu-1", responderId: "unit-a" });
      assert.equal(canSeeLiveEvent(student, r), false);
      assert.equal(canSeeLiveEvent(responder, r), false);
    }
  });

  it("sends campus broadcasts to everyone signed in", () => {
    const alert = row({ kind: "alert", ownerId: null, responderId: null });
    assert.equal(canSeeLiveEvent(student, alert), true);
    assert.equal(canSeeLiveEvent(responder, alert), true);
  });

  it("never matches a missing owner to a viewer", () => {
    assert.equal(canSeeLiveEvent(student, row({ ownerId: null, responderId: null })), false);
  });
});

describe("advanceCursor", () => {
  it("delivers new ids in order and moves forward", () => {
    const c = newCursor(10);
    assert.deepEqual(advanceCursor(c, [12, 11], 0), [11, 12]);
    assert.equal(c.last, 12);
    assert.deepEqual(advanceCursor(c, [11, 12], 0), []);
  });

  it("re-reads a skipped id so a late commit is still delivered once", () => {
    const c = newCursor(10);
    // 11 was handed out first but committed after 12.
    assert.deepEqual(advanceCursor(c, [12], 0), [12]);
    assert.equal(readFrom(c), 10);
    assert.deepEqual(advanceCursor(c, [11, 12], 100), [11]);
    assert.equal(readFrom(c), 12);
    assert.deepEqual(advanceCursor(c, [11, 12], 200), []);
  });

  it("gives up on a skipped id after a few seconds (rolled-back insert)", () => {
    const c = newCursor(10);
    advanceCursor(c, [12], 0);
    advanceCursor(c, [12], GAP_WAIT_MS);
    assert.equal(c.gaps.size, 0);
    assert.equal(readFrom(c), 12);
  });

  it("bounds how many gaps it tracks after a big jump", () => {
    const c = newCursor(0);
    assert.deepEqual(advanceCursor(c, [100_000], 0), [100_000]);
    assert.ok(c.gaps.size <= 200);
  });
});

describe("resumePoint", () => {
  const log = { oldest: 50, newest: 120 };

  it("starts at the newest row on a first connection", () => {
    assert.deepEqual(resumePoint(null, log), { from: 120, resync: false });
    assert.deepEqual(resumePoint("", log), { from: 120, resync: false });
  });

  it("resumes after the last id the browser saw", () => {
    assert.deepEqual(resumePoint("100", log), { from: 100, resync: false });
    assert.deepEqual(resumePoint("49", log), { from: 49, resync: false });
    assert.deepEqual(resumePoint("120", log), { from: 120, resync: false });
  });

  it("asks screens to reload when the gap was pruned or the log was reset", () => {
    assert.deepEqual(resumePoint("10", log), { from: 120, resync: true });
    assert.deepEqual(resumePoint("500", log), { from: 120, resync: true });
  });

  it("ignores a malformed id", () => {
    assert.deepEqual(resumePoint("1; drop table x", log), { from: 120, resync: false });
    assert.deepEqual(resumePoint("-5", log), { from: 120, resync: false });
  });

  it("resumes when nothing was logged since", () => {
    assert.deepEqual(resumePoint("7", { oldest: null, newest: 7 }), { from: 7, resync: false });
  });
});

describe("wire format", () => {
  it("writes one SSE message with JSON data", () => {
    assert.equal(
      formatSse({ event: "change", id: 7, data: { kind: "sos", id: "a" } }),
      'id: 7\nevent: change\ndata: {"kind":"sos","id":"a"}\n\n',
    );
    assert.equal(formatSse({ retry: 500, event: "ping" }), "retry: 500\nevent: ping\ndata: \n\n");
  });

  it("keeps hostile ids on one data line", () => {
    const out = formatSse({ event: "change", data: { kind: "sos", id: "x\n\nevent: evil" } });
    assert.equal(out.split("\n\n").length, 2);
  });

  it("parses only well-formed change events", () => {
    assert.deepEqual(parseLiveEvent('{"kind":"incident","id":"i-1"}'), {
      kind: "incident",
      id: "i-1",
    });
    assert.equal(parseLiveEvent('{"kind":"users","id":"u"}'), null);
    assert.equal(parseLiveEvent('{"kind":"sos","id":""}'), null);
    assert.equal(parseLiveEvent('{"kind":"sos"}'), null);
    assert.equal(parseLiveEvent("not json"), null);
    assert.equal(parseLiveEvent("null"), null);
  });
});

describe("browser decisions", () => {
  it("matches a screen's kinds and optional case id", () => {
    const ev = { kind: "sos" as const, id: "a" };
    assert.equal(matchesLiveFilter(ev, { kinds: ["sos"] }), true);
    assert.equal(matchesLiveFilter(ev, { kinds: ["sos"], id: "a" }), true);
    assert.equal(matchesLiveFilter(ev, { kinds: ["sos"], id: "b" }), false);
    assert.equal(matchesLiveFilter(ev, { kinds: ["incident", "anonymous"] }), false);
  });

  it("trusts the stream only while it is up and recently heard from", () => {
    assert.equal(streamHealthy({ closed: false, lastMessageAt: 1000 }, 2000), true);
    assert.equal(streamHealthy({ closed: false, lastMessageAt: null }, 2000), false);
    assert.equal(streamHealthy({ closed: true, lastMessageAt: 1000 }, 2000), false);
    assert.equal(
      streamHealthy({ closed: false, lastMessageAt: 1000 }, 1000 + LIVE_STALE_MS),
      false,
    );
  });

  it("throttles refreshes but runs the first at once", () => {
    assert.equal(refreshDelay(null, 5000, 1000), 0);
    assert.equal(refreshDelay(4800, 5000, 1000), 800);
    assert.equal(refreshDelay(3000, 5000, 1000), 0);
  });
});
