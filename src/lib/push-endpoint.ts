/**
 * Kept apart from `backend/core/web-push.ts` (which needs Node's crypto) because
 * the subscription validator in `backend/functions/push.ts` also runs in the
 * browser bundle.
 *
 * Push services this server will POST to. The endpoint comes from the browser,
 * so without this list a caller could make the server send requests to any URL
 * (server-side request forgery). These cover Chrome/Edge/Brave/Samsung (FCM),
 * Firefox, Safari and Windows.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
