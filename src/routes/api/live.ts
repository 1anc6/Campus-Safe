import { createFileRoute } from "@tanstack/react-router";

/**
 * `GET /api/live` — real-time updates as Server-Sent Events (see
 * `src/backend/core/live.ts`). Signed-in users only; each user receives only
 * `{ kind, id }` signals for cases they may open, and the screen re-fetches the
 * case through its usual, access-checked server function.
 */
export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireUserId } = await import("@/lib/auth/verify.server");
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        const { loadLiveViewer, openLiveStream } = await import("@/backend/core/live");
        let userId: string;
        try {
          assertSameSiteRequest();
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const viewer = await loadLiveViewer(userId);
        const body = openLiveStream(viewer, request.headers.get("last-event-id"), request.signal);
        return new Response(body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, no-transform",
            // Ask proxies (nginx-style) not to buffer the stream.
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
