import type { AnonRole, IncidentStatus, Severity, SosStatus, UserRole } from "./campus";
export type { IncidentStatus };

export type Profile = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** Emergency details a student shares with responders during an SOS. */
export type MedicalInfo = {
  bloodGroup: BloodGroup | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  medicalNotes: string | null;
};

/** Everything the student can see and edit in their profile panel. */
export type MyProfile = Profile &
  MedicalInfo & {
    course: string | null;
    studentId: string | null;
    shareMedical: boolean;
    /** Has a password login (email change and password change need it). */
    hasPassword: boolean;
  };

export type GpsFix = {
  lat: number;
  lng: number;
  acc: number | null;
  approx: boolean;
};

export type SosAlert = {
  id: string;
  userId: string;
  reporterName: string;
  reporterPhone: string | null;
  reporterAvatar: string | null;
  /** Reporter's medical ID — null when they have not shared one. */
  reporterMedical: MedicalInfo | null;
  status: SosStatus;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  isApproximate: boolean;
  assignedTo: string | null;
  assignedName: string | null;
  assignedPhone: string | null;
  notes: string | null;
  startedAt: string;
  receivedAt: string | null;
  assignedAt: string | null;
  arrivedAt: string | null;
  resolvedAt: string | null;
  /** Time of the most recent GPS point received for this alert (live list only). */
  lastPingAt?: string | null;
};

export type SosPoint = {
  id: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
};

export type Incident = {
  id: string;
  userId: string;
  reporterName: string;
  categoryId: string;
  categoryName: string;
  locationId: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  occurredAt: string;
  photoData: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnonymousReport = {
  id: string;
  trackingCode: string;
  categoryId: string;
  categoryName: string;
  locationId: string;
  locationName: string;
  role: AnonRole;
  timeRange: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  photoStripped: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  kind: "sos" | "incident" | "anonymous";
  subjectId: string;
  authorRole: "reporter" | "admin" | "responder" | "system";
  authorId: string | null;
  body: string;
  createdAt: string;
};

export type QueueItem = {
  id: string;
  kind: "sos" | "incident" | "anonymous";
  title: string;
  place: string;
  severity: Severity;
  status: string;
  startedAt: string;
  lat: number | null;
  lng: number | null;
};

export type Responder = {
  id: string;
  name: string;
  unit: string;
  phone: string | null;
  userId: string | null;
  status: "available" | "on_duty" | "off_duty";
};

export type LivePayload = {
  counters: {
    activeSos: number;
    incoming: number;
    inProgress: number;
    resolvedToday: number;
  };
  queue: QueueItem[];
  sos: SosAlert[];
  incidents: { lat: number; lng: number; severity: Severity; id: string }[];
  anonymous: { lat: number; lng: number; severity: Severity; id: string }[];
  daily: { day: string; count: number; isToday: boolean }[];
  hotspots: { locationId: string; name: string; count: number }[];
  categories: { categoryId: string; name: string; count: number }[];
  avgResponseMin: number;
  responders: Responder[];
  /** Recent GPS trail (oldest → newest) for each open SOS alert. */
  trails: { alertId: string; points: { lat: number; lng: number }[] }[];
  /** SOS alerts closed in the last 24 hours, newest first. */
  recentSos: RecentSos[];
};

export type RecentSos = {
  id: string;
  reporterName: string;
  status: "resolved" | "cancelled";
  /** Who closed it: the student ("I'm safe"), command/responder, or a cancelled countdown. */
  closedBy: "reporter" | "command" | "cancelled";
  startedAt: string;
  closedAt: string;
  assignedName: string | null;
  lat: number | null;
  lng: number | null;
  isApproximate: boolean;
};

export type ActivityItem = {
  id: string;
  kind: "sos" | "incident" | "anonymous";
  title: string;
  status: string;
  at: string;
};
