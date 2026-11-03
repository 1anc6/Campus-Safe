import { createFileRoute } from "@tanstack/react-router";

/**
 * `GET /api/photos/incident/$id` — the photo attached to an incident, as an
 * image. Same access rule as the case itself (lib/access.ts): the reporter,
 * command, or the assigned responder. Private browser caching only, so a shared
 * proxy never keeps a copy.
 */
export const Route = createFileRoute("/api/photos/incident/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { requireUserId } = await import("@/lib/auth/verify.server");
        const { getSql } = await import("@/backend/db");
        const { accessToIncident, loadIncidentViewer } =
          await import("@/backend/core/incident-access");
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const access = await accessToIncident(await loadIncidentViewer(userId), params.id);
        if (!access?.canView) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const rows = await sql<{ mime: string; data: Uint8Array }>`
          select mime, data from incident_photos where incident_id = ${params.id}
        `;
        const photo = rows[0];
        if (!photo) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(photo.data), {
          headers: {
            "Content-Type": photo.mime,
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
