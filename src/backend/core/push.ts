import { getSql } from "@/backend/db";
import { toPayload, type PushMessage } from "@/lib/push-messages";
import type { PushSubscriptionKeys, VapidKeys } from "@/backend/core/web-push";

/**
 * `web-push.ts` needs Node's crypto. It is loaded on first use instead of at the
 * top: `openSosForUser` (sos.ts) is a plain export, so in dev this module is also
 * pulled into the browser graph, where a static `node:crypto` import would crash.
 */
const loadWebPush = () => import("@/backend/core/web-push");

/**
 * Server side of phone notifications: who should get a message, and sending it
 * without ever holding up the action that caused it.
 *
 * Switched off quietly (no errors, no prompts in the app) unless
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set to a valid key pair.
 */

/** The keys from the environment, unchecked (cheap: no crypto). Null = push off. */
function vapidFromEnv(): VapidKeys | null {
  const env = typeof process !== "undefined" ? process.env : {};
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Push services want a way to reach the operator: mailto: or https: only.
  const site = env.BETTER_AUTH_URL?.trim();
  const subject =
    env.VAPID_SUBJECT?.trim() ||
    (site?.startsWith("https://") ? site : "mailto:campus-safe@example.com");
  return { publicKey, privateKey, subject };
}

let checked: Promise<VapidKeys | null> | undefined;

/** The VAPID keys once confirmed to be a matching pair, or null (push off). */
export function vapidConfig(): Promise<VapidKeys | null> {
  checked ??= (async () => {
    const keys = vapidFromEnv();
    if (!keys) return null;
    const { vapidKeysValid } = await loadWebPush();
    if (vapidKeysValid(keys)) return keys;
    console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not a valid pair; push is off.");
    return null;
  })();
  return checked;
}

export type Audience =
  | { userIds: string[] }
  | { role: "admin" | "student" }
  /** Every account linked to one responder unit. */
  | { responderId: string };

type SubRow = PushSubscriptionKeys & { user_id: string };

async function subscriptionsFor(audience: Audience): Promise<SubRow[]> {
  const sql = await getSql();
  if ("userIds" in audience) {
    const ids = [...new Set(audience.userIds.filter(Boolean))];
    if (ids.length === 0) return [];
    return sql<SubRow>`
      select user_id, endpoint, p256dh, auth from push_subscriptions
      where user_id = any(${ids}::text[])
    `;
  }
  if ("role" in audience) {
    return sql<SubRow>`
      select s.user_id, s.endpoint, s.p256dh, s.auth
      from push_subscriptions s join profiles p on p.user_id = s.user_id
      where p.role = ${audience.role}
    `;
  }
  return sql<SubRow>`
    select s.user_id, s.endpoint, s.p256dh, s.auth
    from push_subscriptions s join responders r on r.user_id = s.user_id
    where r.id = ${audience.responderId}
  `;
}

/** Push services in flight at once (see `mapWithLimit`). */
const CONCURRENCY = 16;

/**
 * Send `message` to every device of `audience` and wait for the result.
 * Subscriptions the push service reports as gone (404/410) are deleted.
 */
export async function deliver(
  audience: Audience,
  message: PushMessage,
): Promise<{ sent: number; failed: number; removed: number }> {
  const vapid = await vapidConfig();
  if (!vapid) return { sent: 0, failed: 0, removed: 0 };
  const subs = await subscriptionsFor(audience);
  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
  const { mapWithLimit, sendWebPush } = await loadWebPush();
  const payload = toPayload(message);
  const results = await mapWithLimit(subs, CONCURRENCY, (sub) =>
    sendWebPush(sub, payload, vapid, { ttl: message.ttl, urgency: message.urgency }),
  );
  const gone = subs.filter((_, i) => {
    const r = results[i];
    return !r.ok && r.gone;
  });
  if (gone.length > 0) {
    const sql = await getSql();
    await sql`delete from push_subscriptions where endpoint = any(${gone.map((s) => s.endpoint)}::text[])`;
  }
  let failed = 0;
  for (const r of results) {
    if (r.ok || r.gone) continue;
    failed += 1;
    // Status only: endpoints are per-device secrets and stay out of logs.
    console.warn(`[push] delivery failed (${r.status ?? r.error ?? "unknown"})`);
  }
  return { sent: results.filter((r) => r.ok).length, failed, removed: gone.length };
}

/**
 * Keep a serverless function alive until `task` settles, without delaying the
 * response. Vercel exposes `waitUntil` through this request-context symbol (it
 * is what `@vercel/functions` reads); elsewhere the promise simply runs on.
 */
function keepAlive(task: Promise<unknown>) {
  try {
    const store = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
      { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined } | undefined;
    store?.get?.()?.waitUntil?.(task);
  } catch {
    /* not on Vercel */
  }
}

/**
 * Fire-and-forget: queue the notification and return at once. A push failure,
 * a slow push service or a database hiccup here can never fail, slow down or
 * roll back the SOS / report / alert that triggered it.
 */
export function notify(audience: Audience, message: PushMessage): void {
  if (!vapidFromEnv()) return;
  const task = Promise.resolve()
    .then(() => deliver(audience, message))
    .catch((err) => console.error("[push] send failed:", (err as Error).message));
  keepAlive(task);
}

/** The student who owns an SOS or incident (null if it is gone). */
export async function caseOwner(kind: "sos" | "incident", id: string): Promise<string | null> {
  const sql = await getSql();
  const rows =
    kind === "sos"
      ? await sql<{ user_id: string }>`select user_id from sos_alerts where id = ${id}`
      : await sql<{ user_id: string }>`select user_id from incidents where id = ${id}`;
  return rows[0]?.user_id ?? null;
}

/** `notify` for a case's owner, looking the owner up in the background too. */
export function notifyCaseOwner(kind: "sos" | "incident", id: string, message: PushMessage): void {
  if (!vapidFromEnv()) return;
  const task = caseOwner(kind, id)
    .then((owner) => (owner ? deliver({ userIds: [owner] }, message) : null))
    .catch((err) => console.error("[push] send failed:", (err as Error).message));
  keepAlive(task);
}
