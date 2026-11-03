import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { purgeExpiredReports } from "@/backend/core/retention";

/**
 * Data retention: Vercel Cron (vite.config.ts, daily at 03:00 UTC) calls
 * `GET /api/cron/retention` with `Authorization: Bearer <CRON_SECRET>`. Closed
 * reports older than RETENTION_DAYS (default 365) are de-identified — see
 * src/backend/core/retention.ts. Disabled unless CRON_SECRET is set.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/retention")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const result = await purgeExpiredReports();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
