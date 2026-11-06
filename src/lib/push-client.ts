import {
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/backend/functions/push";

/**
 * Browser side of phone notifications: register the service worker, ask for
 * permission (only ever from a button the person pressed), subscribe, and tell
 * the server. Every function is safe to call in browsers without push support.
 */

export type PushState =
  /** This browser can't do Web Push at all. */
  | "unsupported"
  /** iPhone/iPad Safari: push only works once CampusSafe is added to the Home Screen. */
  | "needs-install"
  /** The server has no VAPID keys, so push is switched off. */
  | "unconfigured"
  /** The person blocked notifications for this site in the browser. */
  | "denied"
  | "off"
  | "on";

const SW_URL = "/sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIosBrowserTab(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

let publicKeyPromise: Promise<string | null> | null = null;

function serverPublicKey(): Promise<string | null> {
  publicKeyPromise ??= getPushConfig()
    .then((c) => c.publicKey)
    .catch(() => {
      publicKeyPromise = null; // offline: try again next time
      return null;
    });
  return publicKeyPromise;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function existingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function saveToServer(sub: PushSubscription) {
  const json = sub.toJSON();
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      userAgent: navigator.userAgent.slice(0, 300),
    },
  });
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIosBrowserTab() ? "needs-install" : "unsupported";
  if (!(await serverPublicKey())) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await existingSubscription()) ? "on" : "off";
}

/**
 * Turn notifications on for this device. Must be called from a click: that is
 * when the browser's own permission prompt is allowed to appear.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return isIosBrowserTab() ? "needs-install" : "unsupported";
  const key = await serverPublicKey();
  if (!key) return "unconfigured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  const appKey = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  // Subscribed under an old server key (keys were rotated): start over.
  if (sub && !sameKey(sub.options.applicationServerKey, appKey)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  await saveToServer(sub);
  return "on";
}

/** Turn notifications off for this device (other devices keep theirs). */
export async function disablePush(): Promise<PushState> {
  const sub = pushSupported() ? await existingSubscription() : null;
  if (sub) {
    await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => false);
  }
  return getPushState();
}

/**
 * On app start: if this device is already subscribed, make sure the server
 * still has it under the signed-in account (it may have been rotated by the
 * browser, or the key pair may have changed). Never prompts.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const sub = await existingSubscription();
  if (!sub) return;
  const key = await serverPublicKey();
  if (!key) return;
  if (sameKey(sub.options.applicationServerKey, keyBytes(key))) {
    await saveToServer(sub);
  } else {
    await enablePush(); // permission is already granted, so this is silent
  }
}

/**
 * Called just before sign-out, while the session still works: forget this
 * device so the next person to use it doesn't receive this account's alerts.
 * Bounded so a slow network never holds up signing out.
 */
export async function forgetPushOnSignOut(): Promise<void> {
  if (!pushSupported()) return;
  await Promise.race([
    (async () => {
      const sub = await existingSubscription();
      if (!sub) return;
      await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => false);
    })(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => {});
}

export async function sendPushTest() {
  return sendTestPush();
}

/** Follow "open this page" requests from the service worker (notification taps). */
export function listenForServiceWorkerMessages(onResubscribe: () => void): () => void {
  if (!pushSupported()) return () => {};
  const handler = (event: MessageEvent) => {
    const msg = event.data as { type?: string; url?: string } | null;
    if (msg?.type === "campussafe:navigate" && typeof msg.url === "string") {
      const url = new URL(msg.url, window.location.origin);
      if (url.origin === window.location.origin) window.location.assign(url.href);
    } else if (msg?.type === "campussafe:push-resubscribe") {
      onResubscribe();
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
