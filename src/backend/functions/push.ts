import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import { getOrCreateProfile } from "@/backend/core/helpers";
import { rateLimit } from "@/backend/core/rate-limit";
import { deliver, vapidConfig } from "@/backend/core/push";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { testNotification } from "@/lib/push-messages";
import { newId } from "@/lib/utils";

/**
 * Phone notifications: the browser subscribes with the server's public VAPID
 * key, then hands its subscription (push-service URL + encryption keys) to
 * `savePushSubscription`. See `core/push.ts` for sending.
 */

/** Devices one account may register; the oldest are dropped beyond this. */
const MAX_DEVICES_PER_USER = 10;

/** The public half of the VAPID key pair, or null when push is switched off. */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: (await vapidConfig())?.publicKey ?? null,
}));

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint, "Unsupported push service"),
  keys: z.object({ p256dh: base64url.min(80).max(100), auth: base64url.min(16).max(44) }),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(subscriptionSchema.extend({ userAgent: z.string().max(300).nullable() }))
  .handler(async ({ context, data }) => {
    if (!(await vapidConfig())) throw new Error("Notifications aren't set up on this server.");
    await rateLimit(`push-save:${context.userId}`, 30, 60 * 60_000);
    await getOrCreateProfile(context.userId);
    const sql = await getSql();
    // One row per device. A device that changes hands (sign out, someone else
    // signs in and turns notifications on) moves to the new account.
    await sql`
      insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
      values (
        ${newId()}, ${context.userId}, ${data.endpoint}, ${data.keys.p256dh},
        ${data.keys.auth}, ${data.userAgent}
      )
      on conflict (endpoint) do update
        set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
            user_agent = excluded.user_agent, updated_at = now()
    `;
    await sql`
      delete from push_subscriptions
      where user_id = ${context.userId} and id not in (
        select id from push_subscriptions where user_id = ${context.userId}
        order by updated_at desc limit ${MAX_DEVICES_PER_USER}
      )
    `;
    return { ok: true as const };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ endpoint: z.string().max(1000) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from push_subscriptions where endpoint = ${data.endpoint} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

/** "Send a test" — to the caller's own devices only. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await rateLimit(`push-test:${context.userId}`, 5, 10 * 60_000);
    return deliver({ userIds: [context.userId] }, testNotification());
  });
