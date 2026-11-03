import { getSql } from "@/backend/db";
import { getOrCreateProfile } from "@/backend/core/helpers";
import {
  incidentAccess,
  type IncidentAccess,
  type IncidentViewer,
  type IncidentVisibility,
} from "@/lib/access";
import { newId } from "@/lib/utils";

/** The caller as the incident policy sees them: role plus the responder units they staff. */
export async function loadIncidentViewer(userId: string): Promise<IncidentViewer> {
  const profile = await getOrCreateProfile(userId);
  if (profile.role === "student") return { userId, role: "student", responderIds: [] };
  const sql = await getSql();
  const units = await sql<{ id: string }>`select id from responders where user_id = ${userId}`;
  return { userId, role: profile.role, responderIds: units.map((u) => u.id) };
}

/** Policy decision for one incident, or null when it does not exist. */
export async function accessToIncident(
  viewer: IncidentViewer,
  incidentId: string,
): Promise<IncidentAccess | null> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    assigned_to: string | null;
    visibility: IncidentVisibility;
  }>`select user_id, assigned_to, visibility from incidents where id = ${incidentId}`;
  const row = rows[0];
  if (!row) return null;
  return incidentAccess(viewer, {
    userId: row.user_id,
    assignedTo: row.assigned_to,
    visibility: row.visibility,
  });
}

/**
 * Record that staff saw who filed a report. One row per person per case per
 * 10 minutes, so a case left open on screen doesn't flood the audit log.
 */
export async function auditReporterView(actorId: string, incidentId: string) {
  const sql = await getSql();
  await sql`
    insert into audit_log (id, actor_id, action, subject_kind, subject_id)
    select ${newId()}, ${actorId}, 'incident.view_reporter', 'incident', ${incidentId}
    where not exists (
      select 1 from audit_log
      where actor_id = ${actorId} and action = 'incident.view_reporter'
        and subject_id = ${incidentId} and created_at > now() - interval '10 minutes'
    )
  `;
}
