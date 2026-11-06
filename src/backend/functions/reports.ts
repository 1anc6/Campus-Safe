import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import type {
  AnonymousReport,
  Incident,
  IncidentReporter,
  IncidentStatus,
  ReporterView,
  ThreadMessage,
} from "@/lib/types";
import { iso, newId, trackingCode } from "@/lib/utils";
import { z } from "zod";
import {
  addSystemMessage,
  audit,
  catName,
  getOrCreateProfile,
  locCoords,
  locName,
  requireAdmin,
  requireStaff,
} from "@/backend/core/helpers";
import {
  accessToIncident,
  auditReporterView,
  loadIncidentViewer,
} from "@/backend/core/incident-access";
import { CATEGORIES, LOCATIONS } from "@/lib/campus";
import {
  INCIDENT_VISIBILITIES,
  RESPONDER_INCIDENT_STATUSES,
  incidentAccess,
  reporterLabel,
  type IncidentVisibility,
} from "@/lib/access";
import { anonymousCallerKey, rateLimit } from "@/backend/core/rate-limit";
import { notify, notifyCaseOwner } from "@/backend/core/push";
import { adminNewAnonymous, adminNewIncident, studentCaseReply } from "@/lib/push-messages";

/** ~3 MB of base64 — the report form already downsizes photos well below this. */
const MAX_PHOTO_CHARS = 4_000_000;
const PHOTO_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,/;

const incidentSchema = z.object({
  categoryId: z.string().max(64),
  locationId: z.string().max(64).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  description: z.string().min(8).max(2000),
  severity: z.enum(["P1", "P2", "P3", "P4"]),
  occurredAt: z.string().datetime({ offset: true }),
  photoData: z
    .string()
    .max(MAX_PHOTO_CHARS, "Photo is too large")
    .regex(PHOTO_DATA_URL, "Unsupported photo format")
    .nullable(),
  visibility: z.enum(INCIDENT_VISIBILITIES).default("identified"),
});

type IncidentRow = {
  id: string;
  user_id: string;
  category_id: string;
  location_id: string | null;
  lat: number | null;
  lng: number | null;
  description: string;
  severity: Incident["severity"];
  status: Incident["status"];
  visibility: IncidentVisibility;
  occurred_at: unknown;
  has_photo: boolean;
  assigned_to: string | null;
  created_at: unknown;
  updated_at: unknown;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  reporter_student_id: string | null;
  reporter_course: string | null;
  reporter_avatar: string | null;
};

const INCIDENT_SELECT = `
  select i.id, i.user_id, i.category_id, i.location_id, i.lat, i.lng, i.description, i.severity,
         i.status, i.visibility, i.occurred_at, i.assigned_to, i.created_at, i.updated_at,
         exists (select 1 from incident_photos ph where ph.incident_id = i.id) as has_photo,
         p.name as reporter_name, p.email as reporter_email, p.phone as reporter_phone,
         p.student_id as reporter_student_id, p.course as reporter_course,
         p.avatar_url as reporter_avatar
  from incidents i
  left join profiles p on p.user_id = i.user_id`;

/**
 * `seesReporter` (from the access policy) decides whether the contact card and
 * real name are included; `isOwner` keeps the student's own name on their view.
 */
function mapIncident(row: IncidentRow, seesReporter: boolean, isOwner: boolean): Incident {
  const reporterName = reporterLabel(
    { userId: row.user_id, visibility: row.visibility },
    row.reporter_name,
    seesReporter,
    isOwner,
  );
  const reporter: IncidentReporter | null = seesReporter
    ? {
        name: reporterName,
        email: row.reporter_email,
        phone: row.reporter_phone,
        studentId: row.reporter_student_id,
        course: row.reporter_course,
        avatarUrl: row.reporter_avatar,
      }
    : null;
  return {
    id: row.id,
    // Only the owner and those who may see the reporter learn the account id.
    userId: seesReporter || isOwner ? row.user_id : "",
    reporterName,
    reporter,
    visibility: row.visibility,
    categoryId: row.category_id,
    categoryName: catName(row.category_id),
    locationId: row.location_id,
    locationName: row.location_id ? locName(row.location_id) : null,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    severity: row.severity,
    status: row.status,
    occurredAt: iso(row.occurred_at),
    photoUrl: row.has_photo ? `/api/photos/incident/${row.id}` : null,
    assignedTo: row.assigned_to,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** `data:image/jpeg;base64,...` → mime + bytes for the incident_photos table. */
function decodePhoto(dataUrl: string): { mime: string; bytes: Buffer } {
  const ext = PHOTO_DATA_URL.exec(dataUrl)?.[1] ?? "jpeg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { mime, bytes: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64") };
}

export const createIncident = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(incidentSchema)
  .handler(async ({ context, data }) => {
    await rateLimit(`incident:${context.userId}`, 10, 60 * 60_000);
    await getOrCreateProfile(context.userId);
    if (!CATEGORIES.some((c) => c.id === data.categoryId)) throw new Error("Invalid category");
    if (data.locationId && !LOCATIONS.some((l) => l.id === data.locationId))
      throw new Error("Invalid location");
    const sql = await getSql();
    const coords =
      data.lat != null && data.lng != null
        ? { lat: data.lat, lng: data.lng }
        : locCoords(data.locationId);
    const id = newId();
    await sql`
      insert into incidents (
        id, user_id, category_id, location_id, lat, lng, description, severity, occurred_at,
        visibility
      ) values (
        ${id}, ${context.userId}, ${data.categoryId}, ${data.locationId},
        ${coords.lat}, ${coords.lng}, ${data.description}, ${data.severity},
        ${data.occurredAt}, ${data.visibility}
      )
    `;
    if (data.photoData) {
      const photo = decodePhoto(data.photoData);
      await sql`
        insert into incident_photos (incident_id, mime, data)
        values (${id}, ${photo.mime}, ${photo.bytes})
      `;
    }
    await addSystemMessage(
      "incident",
      id,
      data.visibility === "confidential"
        ? "Confidential incident filed. Only campus command can see who reported it."
        : "Incident filed with campus command.",
    );
    await audit(context.userId, "incident.create", "incident", id, data.visibility);
    notify({ role: "admin" }, adminNewIncident(id, data.severity));
    return { id };
  });

export const listMyIncidents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<IncidentRow>(
      `${INCIDENT_SELECT} where i.user_id = $1 order by i.created_at desc limit 100`,
      [context.userId],
    );
    return rows.map((r) => mapIncident(r, false, true));
  });

export const getIncident = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const viewer = await loadIncidentViewer(context.userId);
    const rows = await sql.query<IncidentRow>(`${INCIDENT_SELECT} where i.id = $1`, [data.id]);
    const row = rows[0];
    if (!row) throw new Error("Not found");
    const access = incidentAccess(viewer, {
      userId: row.user_id,
      assignedTo: row.assigned_to,
      visibility: row.visibility,
    });
    if (!access.canView) throw new Error("Forbidden");
    const isOwner = row.user_id === context.userId;
    if (access.seesReporter) await auditReporterView(context.userId, row.id);
    const messages = await loadThread("incident", data.id);
    // Command can see who has looked at the reporter's details on this case.
    let reporterViews: ReporterView[] = [];
    if (viewer.role === "admin") {
      const views = await sql<{ name: string | null; at: unknown }>`
        select p.name, max(l.created_at) as at
        from audit_log l left join profiles p on p.user_id = l.actor_id
        where l.action = 'incident.view_reporter' and l.subject_id = ${row.id}
        group by l.actor_id, p.name
        order by at desc
        limit 20
      `;
      reporterViews = views.map((v) => ({ name: v.name ?? "Staff member", at: iso(v.at) }));
    }
    return {
      incident: mapIncident(row, access.seesReporter, isOwner),
      messages,
      canWork: access.canWork,
      reporterViews,
    };
  });

/** Open incidents assigned to the caller's responder unit(s), for the field app. */
export const listAssignedIncidents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const viewer = await loadIncidentViewer(context.userId);
    if (viewer.responderIds.length === 0) return [];
    const sql = await getSql();
    const rows = await sql.query<IncidentRow>(
      `${INCIDENT_SELECT}
       where i.assigned_to = any($1::text[]) and i.status not in ('resolved', 'closed')
       order by i.severity asc, i.created_at asc`,
      [viewer.responderIds],
    );
    return rows.map((r) => {
      const access = incidentAccess(viewer, {
        userId: r.user_id,
        assignedTo: r.assigned_to,
        visibility: r.visibility,
      });
      return mapIncident(r, access.seesReporter, false);
    });
  });

export const assignIncident = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1), responderId: z.string().min(1).nullable() }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    let label = "Unassigned";
    if (data.responderId) {
      const r = await sql<{
        name: string;
      }>`select name from responders where id = ${data.responderId}`;
      if (!r[0]) throw new Error("Unknown responder");
      label = r[0].name;
    }
    const updated = await sql<{ id: string; status: string }>`
      update incidents
      set assigned_to = ${data.responderId},
          status = case when ${data.responderId}::text is not null and status in ('reported', 'under_review')
                        then 'in_progress' else status end
      where id = ${data.id}
      returning id, status
    `;
    if (!updated[0]) throw new Error("Not found");
    await addSystemMessage(
      "incident",
      data.id,
      data.responderId ? `Assigned to ${label}.` : "Assignment cleared.",
    );
    await audit(context.userId, "incident.assign", "incident", data.id, data.responderId ?? "none");
    return { ok: true as const, status: updated[0].status };
  });

export const createAnonymous = createServerFn({ method: "POST" })
  .validator(
    z.object({
      categoryId: z.string(),
      locationId: z.string(),
      role: z.enum(["victim", "witness", "heard"]),
      timeRange: z.string().min(2).max(80),
      description: z.string().min(8).max(2000),
      severity: z.enum(["P1", "P2", "P3", "P4"]),
      photoStripped: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await rateLimit(anonymousCallerKey("anon-create"), 5, 60 * 60_000);
    if (!CATEGORIES.some((c) => c.id === data.categoryId)) throw new Error("Invalid category");
    if (!LOCATIONS.some((l) => l.id === data.locationId)) throw new Error("Invalid location");
    const sql = await getSql();
    const id = newId();
    const code = trackingCode();
    await sql`
      insert into anonymous_reports (
        id, tracking_code, category_id, location_id, role, time_range,
        description, severity, photo_stripped
      ) values (
        ${id}, ${code}, ${data.categoryId}, ${data.locationId}, ${data.role},
        ${data.timeRange}, ${data.description}, ${data.severity}, ${data.photoStripped}
      )
    `;
    await addSystemMessage(
      "anonymous",
      id,
      "Anonymous report received. Identity was never stored.",
    );
    // Severity only: nothing in the notification may point back to the reporter.
    notify({ role: "admin" }, adminNewAnonymous(data.severity));
    return { id, code };
  });

function mapAnon(row: {
  id: string;
  tracking_code: string;
  category_id: string;
  location_id: string;
  role: AnonymousReport["role"];
  time_range: string;
  description: string;
  severity: AnonymousReport["severity"];
  status: AnonymousReport["status"];
  photo_stripped: boolean;
  created_at: unknown;
  updated_at: unknown;
}): AnonymousReport {
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    categoryId: row.category_id,
    categoryName: catName(row.category_id),
    locationId: row.location_id,
    locationName: locName(row.location_id),
    role: row.role,
    timeRange: row.time_range,
    description: row.description,
    severity: row.severity,
    status: row.status,
    photoStripped: Boolean(row.photo_stripped),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export const trackAnonymous = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().max(32) }))
  .handler(async ({ data }) => {
    // The code is the only credential for an anonymous report: cap guessing.
    await rateLimit(anonymousCallerKey("anon-track"), 30, 10 * 60_000);
    const sql = await getSql();
    const code = data.code.trim().toUpperCase();
    const rows = await sql`select * from anonymous_reports where tracking_code = ${code}`;
    const row = (rows as Parameters<typeof mapAnon>[0][])[0];
    if (!row) return { report: null, messages: [] as ThreadMessage[] };
    const messages = await loadThread("anonymous", row.id);
    return { report: mapAnon(row), messages };
  });

export const replyAnonymousPublic = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().max(32), body: z.string().trim().min(1).max(1000) }))
  .handler(async ({ data }) => {
    await rateLimit(anonymousCallerKey("anon-reply"), 20, 60 * 60_000);
    const sql = await getSql();
    const code = data.code.trim().toUpperCase();
    const rows = await sql<{
      id: string;
      status: string;
    }>`select id, status from anonymous_reports where tracking_code = ${code}`;
    if (!rows[0]) throw new Error("Not found");
    if (rows[0].status === "closed") throw new Error("This report is closed.");
    await sql`
      insert into threads (id, kind, subject_id, author_role, author_id, body)
      values (${newId()}, ${"anonymous"}, ${rows[0].id}, ${"reporter"}, ${null}, ${data.body.trim()})
    `;
    return { ok: true };
  });

export const staffSetIncidentStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["reported", "under_review", "in_progress", "resolved", "closed"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const viewer = await loadIncidentViewer(context.userId);
    const access = await accessToIncident(viewer, data.id);
    if (!access) throw new Error("Not found");
    if (!access.canWork) throw new Error("Forbidden");
    if (
      viewer.role !== "admin" &&
      !(RESPONDER_INCIDENT_STATUSES as readonly string[]).includes(data.status)
    ) {
      throw new Error("Only command can set that status");
    }
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update incidents set status = ${data.status} where id = ${data.id} returning id
    `;
    if (!updated[0]) throw new Error("Not found");
    await addSystemMessage("incident", data.id, `Status set to ${data.status.replace("_", " ")}.`);
    await audit(context.userId, "incident.status", "incident", data.id, data.status);
    return { ok: true };
  });

export const staffSetAnonymousStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["reported", "under_review", "in_progress", "resolved", "closed"]),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update anonymous_reports set status = ${data.status} where id = ${data.id} returning id
    `;
    if (!updated[0]) throw new Error("Not found");
    await addSystemMessage("anonymous", data.id, `Status set to ${data.status.replace("_", " ")}.`);
    await audit(context.userId, "anonymous.status", "anonymous", data.id, data.status);
    return { ok: true };
  });

export const postThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      kind: z.enum(["sos", "incident", "anonymous"]),
      subjectId: z.string(),
      body: z.string().min(1).max(1000),
    }),
  )
  .handler(async ({ context, data }) => {
    const profile = await requireStaff(context.userId);
    const sql = await getSql();
    // Responders may only write on SOS alerts and incidents assigned to their
    // unit; anonymous threads are command-only. Admins may write anywhere.
    if (profile.role !== "admin" && data.kind === "incident") {
      const viewer = await loadIncidentViewer(context.userId);
      const access = await accessToIncident(viewer, data.subjectId);
      if (!access?.canWork) throw new Error("Forbidden");
    } else if (profile.role !== "admin") {
      if (data.kind !== "sos") throw new Error("Forbidden");
      const own = await sql<{ id: string }>`
        select s.id from sos_alerts s
        join responders r on r.id = s.assigned_to
        where s.id = ${data.subjectId} and r.user_id = ${context.userId}
      `;
      if (!own[0]) throw new Error("Forbidden");
    } else {
      const table = { sos: "sos_alerts", incident: "incidents", anonymous: "anonymous_reports" }[
        data.kind
      ];
      const exists = await sql.query<{ id: string }>(`select id from ${table} where id = $1`, [
        data.subjectId,
      ]);
      if (!exists[0]) throw new Error("Not found");
    }
    await sql`
      insert into threads (id, kind, subject_id, author_role, author_id, body)
      values (
        ${newId()}, ${data.kind}, ${data.subjectId},
        ${profile.role === "responder" ? "responder" : "admin"},
        ${context.userId}, ${data.body.trim()}
      )
    `;
    // Tell the student who owns the case (anonymous reporters have no device on file).
    if (data.kind !== "anonymous") {
      notifyCaseOwner(data.kind, data.subjectId, studentCaseReply(data.kind, data.subjectId));
    }
    return { ok: true };
  });

async function loadThread(kind: "sos" | "incident" | "anonymous", subjectId: string) {
  const sql = await getSql();
  const messages = await sql<{
    id: string;
    kind: ThreadMessage["kind"];
    subject_id: string;
    author_role: ThreadMessage["authorRole"];
    author_id: string | null;
    body: string;
    created_at: unknown;
  }>`select id, kind, subject_id, author_role, author_id, body, created_at from threads where kind = ${kind} and subject_id = ${subjectId} order by created_at asc`;
  return messages.map((m): ThreadMessage => ({
    id: m.id,
    kind: m.kind,
    subjectId: m.subject_id,
    authorRole: m.author_role,
    authorId: m.author_id,
    body: m.body,
    createdAt: iso(m.created_at),
  }));
}

export type { IncidentStatus };
