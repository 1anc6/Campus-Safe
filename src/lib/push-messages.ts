/**
 * Every phone notification CampusSafe sends, in one place.
 *
 * Rules (they show on lock screens and in notification history, where anyone
 * holding the phone can read them):
 * - short, and never personal: no names, phone numbers, medical details,
 *   message text or exact location — the page behind the tap has those;
 * - anonymous reports say nothing about the reporter, ever;
 * - `tag` groups updates about the same case, so a phone shows the latest one
 *   instead of a pile.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Same-origin path opened when the notification is tapped. */
  url: string;
  tag: string;
  /** `high` wakes a sleeping phone straight away (SOS); `normal` may be batched. */
  urgency: "high" | "normal";
  /** Seconds the push service keeps it for a phone that is offline. */
  ttl: number;
  /** Keep it on screen until the person acts (desktop browsers honour this). */
  requireInteraction?: boolean;
};

export type Severity = "P1" | "P2" | "P3" | "P4";
export type SosStage = "received" | "assigned" | "arrived" | "resolved";

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Shorten to `max` characters on a word boundary where possible. */
export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Campus command: a new SOS. `automatic` = raised by a missed safe-walk check-in. */
export function adminNewSos(sosId: string, automatic = false): PushMessage {
  return {
    title: "New SOS",
    body: automatic
      ? "Raised automatically after a missed walk check-in. Tap for the live location."
      : "A student needs help now. Tap for the live location.",
    url: `/admin/sos/${encodeURIComponent(sosId)}`,
    tag: `sos-${sosId}`,
    urgency: "high",
    ttl: HOUR,
    requireInteraction: true,
  };
}

/** Campus command: a signed-in student filed an incident. */
export function adminNewIncident(incidentId: string, severity: Severity): PushMessage {
  return {
    title: `New ${severity} incident report`,
    body: "Waiting in the incident queue for review.",
    url: `/admin/incidents/${encodeURIComponent(incidentId)}`,
    tag: `incident-${incidentId}`,
    urgency: severity === "P1" ? "high" : "normal",
    ttl: DAY,
  };
}

/**
 * Campus command: a new anonymous report. Only the severity is mentioned — no
 * id, category, place or wording that could hint at who sent it.
 */
export function adminNewAnonymous(severity: Severity): PushMessage {
  return {
    title: `New ${severity} anonymous report`,
    body: "Open the anonymous inbox to review it.",
    url: "/admin/anonymous",
    tag: "anonymous-new",
    urgency: severity === "P1" ? "high" : "normal",
    ttl: DAY,
  };
}

/** Responder: command assigned an SOS to their unit. */
export function responderSosAssigned(sosId: string): PushMessage {
  return {
    title: "SOS assigned to you",
    body: "Tap for the live location and route.",
    url: `/staff/${encodeURIComponent(sosId)}`,
    tag: `sos-${sosId}`,
    urgency: "high",
    ttl: HOUR,
    requireInteraction: true,
  };
}

const SOS_STAGE_TEXT: Record<SosStage, { title: string; body: string }> = {
  received: { title: "SOS received", body: "Campus command has your alert and location." },
  assigned: { title: "Responder assigned", body: "Help is on the way. Keep your phone with you." },
  arrived: { title: "Help is arriving", body: "Your responder has reached your location." },
  resolved: { title: "SOS resolved", body: "Your alert is closed. Stay safe." },
};

/** Student: progress on their own SOS. */
export function studentSosUpdate(sosId: string, stage: SosStage): PushMessage {
  return {
    ...SOS_STAGE_TEXT[stage],
    url: `/sos/${encodeURIComponent(sosId)}`,
    tag: `sos-${sosId}`,
    urgency: stage === "resolved" ? "normal" : "high",
    ttl: stage === "resolved" ? DAY : HOUR,
  };
}

/** Student: command or a responder wrote on their case. The message itself stays in the app. */
export function studentCaseReply(kind: "sos" | "incident", subjectId: string): PushMessage {
  const id = encodeURIComponent(subjectId);
  return kind === "sos"
    ? {
        title: "New message about your SOS",
        body: "Tap to read it.",
        url: `/sos/${id}`,
        tag: `sos-msg-${subjectId}`,
        urgency: "high",
        ttl: HOUR,
      }
    : {
        title: "Reply on your report",
        body: "Campus command sent you a message. Tap to read it.",
        url: `/reports/${id}`,
        tag: `incident-${subjectId}`,
        urgency: "normal",
        ttl: DAY,
      };
}

/** Students: a campus-wide broadcast. Public by nature, so its own words are used. */
export function campusAlert(alert: {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
}): PushMessage {
  return {
    title: clip(alert.level === "critical" ? `Urgent: ${alert.title}` : alert.title, 80),
    body: clip(alert.body, 140),
    url: "/",
    tag: `alert-${alert.id}`,
    urgency: alert.level === "info" ? "normal" : "high",
    ttl: alert.level === "critical" ? 6 * HOUR : DAY,
    requireInteraction: alert.level === "critical",
  };
}

/** Sent by "Send a test" after someone turns notifications on. */
export function testNotification(): PushMessage {
  return {
    title: "Notifications are on",
    body: "This is how CampusSafe alerts will reach this device.",
    url: "/",
    tag: "push-test",
    urgency: "normal",
    ttl: 10 * 60,
  };
}

/** What the service worker receives (delivery hints stay on the server). */
export function toPayload(m: PushMessage): string {
  return JSON.stringify({
    title: m.title,
    body: m.body,
    url: m.url,
    tag: m.tag,
    urgent: m.urgency === "high",
    requireInteraction: Boolean(m.requireInteraction),
  });
}
