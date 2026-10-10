import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { escalateOverdueWalks } from "@/backend/functions/walks";

/**
 * Backstop for the safe-walk watchdog: an external scheduler (e.g. cron-job.org,
 * every minute) calls `GET /api/cron/walks` with `Authorization: Bearer
 * <CRON_SECRET>`, so overdue walks escalate even when nobody has the app open.
 * Disabled unless CRON_SECRET is set.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/walks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const escalated = await escalateOverdueWalks({ force: true });
        return Response.json({ ok: true, escalated });
      },
    },
  },
});
