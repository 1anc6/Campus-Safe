import type { UserRole } from "./campus";

/**
 * Who may see an identified incident, and how much of the reporter they see.
 * Pure and client-safe so the rules are unit-tested (access.test.ts); the
 * server functions in `src/backend/functions/reports.ts` enforce exactly this.
 *
 *   identified   — command (admins) and the assigned responder see the reporter.
 *   confidential — only command sees the reporter; the assigned responder works
 *                  the case without knowing who filed it.
 *
 * Anonymous reports are a separate table with no user id at all, so they never
 * reach this policy.
 */

export const INCIDENT_VISIBILITIES = ["identified", "confidential"] as const;
export type IncidentVisibility = (typeof INCIDENT_VISIBILITIES)[number];

/** Reports filed by the seed script or de-identified by retention: no real reporter. */
export const SEED_REPORTER = "seed-campus";
export const REDACTED_REPORTER = "redacted";

export type IncidentViewer = {
  userId: string;
  role: UserRole;
  /** Responder unit ids this user staffs (empty for students). */
  responderIds: readonly string[];
};

export type IncidentSubject = {
  userId: string;
  assignedTo: string | null;
  visibility: IncidentVisibility;
};

export type IncidentAccess = {
  /** May open the case at all. */
  canView: boolean;
  /** May see who filed it (name, student ID, contact). */
  seesReporter: boolean;
  /** May change status and write remarks. */
  canWork: boolean;
};

const NONE: IncidentAccess = { canView: false, seesReporter: false, canWork: false };

export function incidentAccess(viewer: IncidentViewer, incident: IncidentSubject): IncidentAccess {
  const hasReporter = incident.userId !== SEED_REPORTER && incident.userId !== REDACTED_REPORTER;
  if (viewer.role === "admin") return { canView: true, seesReporter: hasReporter, canWork: true };
  if (viewer.role === "responder") {
    const assigned =
      incident.assignedTo !== null && viewer.responderIds.includes(incident.assignedTo);
    if (!assigned) return NONE;
    return {
      canView: true,
      seesReporter: hasReporter && incident.visibility === "identified",
      canWork: true,
    };
  }
  // A student sees their own report; the contact card is about them, so it is not sent.
  if (incident.userId === viewer.userId)
    return { canView: true, seesReporter: false, canWork: false };
  return NONE;
}

/** Name to print for the reporter when the viewer may not see who it is. */
export function reporterLabel(
  incident: { userId: string; visibility: IncidentVisibility },
  name: string | null,
  seesReporter: boolean,
  isOwner: boolean,
): string {
  if (incident.userId === SEED_REPORTER) return "Campus archive";
  if (incident.userId === REDACTED_REPORTER) return "Removed (retention)";
  if (seesReporter || isOwner) return name ?? "Campus member";
  return incident.visibility === "confidential" ? "Confidential reporter" : "Campus member";
}

/** Statuses an assigned responder may set; closing and reopening stay with command. */
export const RESPONDER_INCIDENT_STATUSES = ["in_progress", "resolved"] as const;
