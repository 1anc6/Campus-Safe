/* CampusSafe service worker — phone notifications only.
 *
 * It has no fetch handler on purpose: pages and data always come straight from
 * the network, so nothing here can ever serve a stale SOS screen.
 *
 * Push payload (see src/lib/push-messages.ts → toPayload):
 *   { title, body, url, tag, urgent, requireInteraction }
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Only ever open pages on this site, whatever the payload says. */
function safeUrl(url) {
  try {
    const target = new URL(url || "/", self.location.origin);
    return target.origin === self.location.origin ? target.href : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "CampusSafe";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icon-180.png",
    badge: "/icon-180.png",
    tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
    // A newer update about the same case replaces the old one — and still buzzes if urgent.
    renotify: Boolean(data.urgent && data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: data.urgent ? [200, 100, 200, 100, 200] : [100],
    data: { url: safeUrl(data.url) },
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || safeUrl("/");
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open CampusSafe tab when there is one; otherwise open a new one.
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) {
          try {
            await existing.navigate(url);
            return;
          } catch {
            /* uncontrolled tab: fall through to postMessage */
          }
        }
        existing.postMessage({ type: "campussafe:navigate", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* The browser rotated this device's subscription: drop it so the app re-registers on next open. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      windows.forEach((w) => w.postMessage({ type: "campussafe:push-resubscribe" }));
    }),
  );
});
