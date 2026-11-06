import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminNewAnonymous,
  adminNewIncident,
  adminNewSos,
  campusAlert,
  clip,
  responderSosAssigned,
  studentCaseReply,
  studentSosUpdate,
  testNotification,
  toPayload,
  type PushMessage,
} from "./push-messages.ts";

const all: PushMessage[] = [
  adminNewSos("s1"),
  adminNewSos("s1", true),
  adminNewIncident("i1", "P2"),
  adminNewAnonymous("P1"),
  responderSosAssigned("s1"),
  studentSosUpdate("s1", "received"),
  studentSosUpdate("s1", "assigned"),
  studentSosUpdate("s1", "arrived"),
  studentSosUpdate("s1", "resolved"),
  studentCaseReply("sos", "s1"),
  studentCaseReply("incident", "i1"),
  campusAlert({
    id: "a1",
    title: "Avoid Gate 2",
    body: "Fire drill until 4 pm.",
    level: "warning",
  }),
  testNotification(),
];

describe("push messages", () => {
  it("stay short enough for a lock screen", () => {
    for (const m of all) {
      assert.ok(m.title.length <= 80, m.title);
      assert.ok(m.body.length <= 140, m.body);
    }
  });

  it("open a page on this site when tapped", () => {
    for (const m of all) assert.match(m.url, /^\/(?!\/)/, m.url);
  });

  it("send the right people to the right page", () => {
    assert.equal(adminNewSos("s1").url, "/admin/sos/s1");
    assert.equal(adminNewIncident("i1", "P3").url, "/admin/incidents/i1");
    assert.equal(responderSosAssigned("s1").url, "/staff/s1");
    assert.equal(studentSosUpdate("s1", "arrived").url, "/sos/s1");
    assert.equal(studentCaseReply("incident", "i1").url, "/reports/i1");
    assert.equal(studentCaseReply("sos", "s1").url, "/sos/s1");
  });

  it("escape ids so a crafted id cannot change the path", () => {
    assert.equal(adminNewSos("../x?y").url, "/admin/sos/..%2Fx%3Fy");
  });

  it("wake the phone at once for SOS but not for routine updates", () => {
    assert.equal(adminNewSos("s1").urgency, "high");
    assert.equal(responderSosAssigned("s1").urgency, "high");
    assert.equal(studentSosUpdate("s1", "assigned").urgency, "high");
    assert.equal(studentSosUpdate("s1", "resolved").urgency, "normal");
    assert.equal(adminNewIncident("i1", "P1").urgency, "high");
    assert.equal(adminNewIncident("i1", "P4").urgency, "normal");
  });

  it("group every update about one SOS under one tag", () => {
    const tags = new Set(
      (["received", "assigned", "arrived", "resolved"] as const).map(
        (s) => studentSosUpdate("s1", s).tag,
      ),
    );
    assert.equal(tags.size, 1);
  });

  it("never reveal anything about an anonymous reporter", () => {
    const m = adminNewAnonymous("P2");
    // No id, tracking code, category, place or wording — only the severity.
    assert.equal(m.url, "/admin/anonymous");
    assert.equal(m.tag, "anonymous-new");
    assert.deepEqual(Object.keys(JSON.parse(toPayload(m))).sort(), [
      "body",
      "requireInteraction",
      "tag",
      "title",
      "urgent",
      "url",
    ]);
    assert.doesNotMatch(`${m.title} ${m.body}`, /CS-|victim|witness|near|at /i);
  });

  it("keep case replies out of the notification itself", () => {
    const m = studentCaseReply("incident", "i1");
    assert.doesNotMatch(m.body, /"/);
    assert.equal(m.body, "Campus command sent you a message. Tap to read it.");
  });

  it("mark urgent campus alerts and trim long ones", () => {
    const m = campusAlert({
      id: "a",
      title: "Lockdown",
      body: "word ".repeat(80),
      level: "critical",
    });
    assert.equal(m.title, "Urgent: Lockdown");
    assert.ok(m.body.length <= 140);
    assert.ok(m.body.endsWith("…"));
    assert.equal(m.requireInteraction, true);
    assert.equal(
      campusAlert({ id: "b", title: "Info", body: "x", level: "info" }).urgency,
      "normal",
    );
  });

  it("send only display fields to the phone", () => {
    const p = JSON.parse(toPayload(adminNewSos("s1")));
    assert.deepEqual(p, {
      title: "New SOS",
      body: "A student needs help now. Tap for the live location.",
      url: "/admin/sos/s1",
      tag: "sos-s1",
      urgent: true,
      requireInteraction: true,
    });
  });
});

describe("clip", () => {
  it("leaves short text alone and collapses whitespace", () => {
    assert.equal(clip("  Gate 2\n closed ", 40), "Gate 2 closed");
  });
  it("cuts on a word boundary with an ellipsis", () => {
    assert.equal(clip("The library is closed until further notice", 20), "The library is…");
  });
  it("hard-cuts a single long word", () => {
    assert.equal(clip("x".repeat(30), 10), `${"x".repeat(9)}…`);
  });
});
