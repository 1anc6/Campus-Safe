import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import { catName } from "@/backend/core/helpers";
import type { StudentNotification } from "@/lib/types";
import { iso } from "@/lib/utils";

/**
 * The student's bell: every update command or a responder made on their own
 * reports (status changes, assignments, remarks), newest first. Built from the
 * case threads, so nothing new has to be written when a case changes.
 * `profiles.notifications_seen_at` marks what they have already seen.
 */
export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ items: StudentNotification[]; unseen: number }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      subject_id: string;
      category_id: string;
      body: string;
      created_at: unknown;
      unseen: boolean;
    }>`
      select t.id, t.subject_id, i.category_id, t.body, t.created_at,
             t.created_at > coalesce(p.notifications_seen_at, '-infinity'::timestamptz) as unseen
      from threads t
      join incidents i on i.id = t.subject_id
      left join profiles p on p.user_id = i.user_id
      where t.kind = 'incident' and i.user_id = ${context.userId}
        and t.author_role <> 'reporter'
        -- skip the "filed" receipt written the moment the student submitted
        and t.created_at > i.created_at + interval '2 seconds'
      order by t.created_at desc
      limit 30
    `;
    return {
      items: rows.map((r) => ({
        id: r.id,
        incidentId: r.subject_id,
        title: catName(r.category_id),
        body: r.body,
        at: iso(r.created_at),
      })),
      unseen: rows.filter((r) => r.unseen).length,
    };
  });

export const markMyNotificationsSeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set notifications_seen_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });
