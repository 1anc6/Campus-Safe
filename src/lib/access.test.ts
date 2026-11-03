import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REDACTED_REPORTER,
  SEED_REPORTER,
  incidentAccess,
  reporterLabel,
  type IncidentSubject,
  type IncidentViewer,
} from "./access.ts";

const student: IncidentViewer = { userId: "stu-1", role: "student", responderIds: [] };
const otherStudent: IncidentViewer = { userId: "stu-2", role: "student", responderIds: [] };
const admin: IncidentViewer = { userId: "adm-1", role: "admin", responderIds: ["self-adm-1"] };
const responder: IncidentViewer = { userId: "res-1", role: "responder", responderIds: ["unit-a"] };
const otherResponder: IncidentViewer = {
  userId: "res-2",
  role: "responder",
  responderIds: ["unit-b"],
};

const named: IncidentSubject = { userId: "stu-1", assignedTo: "unit-a", visibility: "identified" };
const confidential: IncidentSubject = { ...named, visibility: "confidential" };

describe("incidentAccess", () => {
  it("lets a student open their own report but never another student's", () => {
    assert.equal(incidentAccess(student, named).canView, true);
    assert.deepEqual(incidentAccess(otherStudent, named), {
      canView: false,
      seesReporter: false,
      canWork: false,
    });
  });

  it("never lets a student work a case, even their own", () => {
    assert.equal(incidentAccess(student, named).canWork, false);
  });

  it("does not send the contact card back to the student who filed it", () => {
    assert.equal(incidentAccess(student, named).seesReporter, false);
  });

  it("shows command the reporter on named and confidential reports", () => {
    assert.equal(incidentAccess(admin, named).seesReporter, true);
    assert.equal(incidentAccess(admin, confidential).seesReporter, true);
  });

  it("shows the assigned responder the reporter only on named reports", () => {
    assert.deepEqual(incidentAccess(responder, named), {
      canView: true,
      seesReporter: true,
      canWork: true,
    });
    assert.deepEqual(incidentAccess(responder, confidential), {
      canView: true,
      seesReporter: false,
      canWork: true,
    });
  });

  it("keeps responders out of reports assigned to another unit or to nobody", () => {
    assert.equal(incidentAccess(otherResponder, named).canView, false);
    assert.equal(incidentAccess(responder, { ...named, assignedTo: null }).canView, false);
  });

  it("has no reporter to show on seeded or retention-redacted reports", () => {
    for (const userId of [SEED_REPORTER, REDACTED_REPORTER]) {
      assert.equal(incidentAccess(admin, { ...named, userId }).seesReporter, false, userId);
      assert.equal(incidentAccess(responder, { ...named, userId }).seesReporter, false, userId);
    }
  });
});

describe("reporterLabel", () => {
  it("names the reporter only for someone allowed to see them", () => {
    assert.equal(reporterLabel(named, "Priya", true, false), "Priya");
    assert.equal(reporterLabel(named, "Priya", false, true), "Priya");
    assert.equal(reporterLabel(confidential, "Priya", false, false), "Confidential reporter");
  });

  it("labels seeded and redacted reports instead of a student", () => {
    assert.equal(
      reporterLabel({ ...named, userId: SEED_REPORTER }, null, true, false),
      "Campus archive",
    );
    assert.equal(
      reporterLabel({ ...named, userId: REDACTED_REPORTER }, "Priya", true, false),
      "Removed (retention)",
    );
  });
});
