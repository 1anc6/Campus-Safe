/**
 * Graphic Era (Deemed to be) University, Bell Road, Clement Town, Dehradun.
 * Centre and building coordinates come from OpenStreetMap (ODbL); adjust here if
 * your campus survey differs.
 */
export const CAMPUS = {
  name: "Graphic Era (Deemed to be) University",
  city: "Clement Town, Dehradun",
  center: { lat: 30.26815, lng: 77.99575 },
  zoom: 17,
  /** South-west / north-east corners of the campus, used to frame the map. */
  bounds: [
    [30.2662, 77.9925],
    [30.2700, 77.9990],
  ] as [[number, number], [number, number]],
} as const;

export type Severity = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus =
  | "reported"
  | "under_review"
  | "in_progress"
  | "resolved"
  | "closed";
export type SosStatus =
  | "sent"
  | "received"
  | "assigned"
  | "arrived"
  | "resolved"
  | "cancelled";
export type AnonRole = "victim" | "witness" | "heard";
export type UserRole = "student" | "responder" | "admin";

export const USER_ROLES: { id: UserRole; label: string }[] = [
  { id: "student", label: "Student" },
  { id: "responder", label: "Responder" },
  { id: "admin", label: "Admin" },
];

export const SEVERITIES: { id: Severity; label: string; hint: string }[] = [
  { id: "P1", label: "Critical", hint: "Immediate danger" },
  { id: "P2", label: "High", hint: "Urgent, not life-threatening" },
  { id: "P3", label: "Medium", hint: "Needs attention today" },
  { id: "P4", label: "Low", hint: "Non-urgent record" },
];

export const INCIDENT_STATUSES: { id: IncidentStatus; label: string }[] = [
  { id: "reported", label: "Reported" },
  { id: "under_review", label: "Under Review" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export const SOS_STEPS: { id: SosStatus; label: string }[] = [
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
  { id: "assigned", label: "Responder assigned" },
  { id: "arrived", label: "Arriving" },
  { id: "resolved", label: "Resolved" },
];

export const CATEGORIES = [
  { id: "harassment", name: "Harassment", icon: "shield-alert" },
  { id: "theft", name: "Theft", icon: "briefcase" },
  { id: "medical", name: "Medical", icon: "heart-pulse" },
  { id: "fire", name: "Fire", icon: "flame" },
  { id: "infra", name: "Infrastructure", icon: "construction" },
  { id: "ragging", name: "Ragging", icon: "user-x" },
  { id: "suspicious", name: "Suspicious", icon: "eye" },
  { id: "accident", name: "Accident", icon: "car-front" },
  { id: "other", name: "Other", icon: "circle-dot" },
] as const;

// Original ids are kept so existing reports keep resolving to a place.
export const LOCATIONS = [
  { id: "gate", name: "Gate 1 (Main Gate)", zone: "Entry", lat: 30.26863, lng: 77.99479 },
  { id: "gate-2", name: "Gate 2", zone: "Entry", lat: 30.26872, lng: 77.99788 },
  { id: "lh3", name: "CS-IT Block", zone: "Academic", lat: 30.26895, lng: 77.99318 },
  { id: "science", name: "B.Tech Block", zone: "Academic", lat: 30.2673, lng: 77.99525 },
  { id: "civil", name: "Civil Engineering Block", zone: "Academic", lat: 30.26686, lng: 77.99547 },
  { id: "aryabhatt", name: "Aryabhatt Computer Center", zone: "Academic", lat: 30.26768, lng: 77.99575 },
  { id: "chanakya", name: "Chanakya Block", zone: "Academic", lat: 30.26749, lng: 77.99699 },
  { id: "vishwakarma", name: "Vishwakarma Block", zone: "Academic", lat: 30.26805, lng: 77.99624 },
  { id: "pharma", name: "Pharma Block", zone: "Academic", lat: 30.26939, lng: 77.99286 },
  { id: "library", name: "Central Library", zone: "Academic", lat: 30.26729, lng: 77.99574 },
  { id: "admin", name: "Silver Jubilee Convention Center", zone: "Admin", lat: 30.2693, lng: 77.99493 },
  { id: "hostel-a", name: "Lakshmi Bai Girls Hostel", zone: "Residence", lat: 30.26768, lng: 77.99361 },
  { id: "hostel-p", name: "Priyadarshini Hostel", zone: "Residence", lat: 30.26872, lng: 77.99617 },
  { id: "mess", name: "Mess", zone: "Commons", lat: 30.26762, lng: 77.99393 },
  { id: "cafe", name: "Cafe and Gym", zone: "Commons", lat: 30.26714, lng: 77.99467 },
  { id: "sports", name: "Basketball Court", zone: "Recreation", lat: 30.26702, lng: 77.99596 },
  { id: "badminton", name: "Indoor Badminton Court", zone: "Recreation", lat: 30.26688, lng: 77.99502 },
  { id: "medical", name: "Dispensary", zone: "Health", lat: 30.26854, lng: 77.99503 },
  { id: "parking", name: "Parking", zone: "Entry", lat: 30.2684, lng: 77.99718 },
] as const;

export const RESPONDER_UNITS = [
  { id: "sec-a", name: "Kavya Nair", unit: "Campus Security A", phone: "+91 80 4450 1101" },
  { id: "med-1", name: "Dr. Arjun Mehta", unit: "Medical Unit 1", phone: "+91 80 4450 1188" },
  { id: "night", name: "Night Patrol", unit: "Night Patrol", phone: "+91 80 4450 1199" },
  { id: "fire", name: "Fire Response", unit: "Fire & Rescue", phone: "+91 80 4450 1122" },
] as const;

/**
 * The security desk students can call from the app shell. Sourced from the
 * configured responder units — set it to your real campus security line.
 */
export const SECURITY_LINE = {
  label: RESPONDER_UNITS[0].unit,
  phone: RESPONDER_UNITS[0].phone,
} as const;

export function locationById(id: string | null | undefined) {
  return LOCATIONS.find((l) => l.id === id) ?? null;
}

export function categoryById(id: string | null | undefined) {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}

export function severityRank(s: Severity | null | undefined): number {
  if (s === "P1") return 0;
  if (s === "P2") return 1;
  if (s === "P3") return 2;
  if (s === "P4") return 3;
  return 4;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The closest named campus place to a point, with its distance. */
export function nearestLocation(point: { lat: number; lng: number }) {
  let best: { name: string; distance: number } | null = null;
  for (const l of LOCATIONS) {
    const d = distanceM(point, l);
    if (!best || d < best.distance) best = { name: l.name, distance: d };
  }
  return best!;
}
