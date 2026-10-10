import { dbSource, getSql } from "@/lib/db";
import { newId } from "@/lib/utils";

const SAMPLE_INCIDENTS: {
  category: string;
  location: string;
  severity: "P1" | "P2" | "P3" | "P4";
  status: string;
  description: string;
  hoursAgo: number;
}[] = [
  {
    category: "theft",
    location: "library",
    severity: "P3",
    status: "under_review",
    description: "Laptop missing from reading hall desk near the west windows.",
    hoursAgo: 4,
  },
  {
    category: "infra",
    location: "lh3",
    severity: "P4",
    status: "in_progress",
    description: "Broken stair nosing on the north staircase, third flight.",
    hoursAgo: 18,
  },
  {
    category: "suspicious",
    location: "parking",
    severity: "P2",
    status: "reported",
    description: "Unfamiliar scooter circling the south lot after midnight.",
    hoursAgo: 9,
  },
  {
    category: "medical",
    location: "sports",
    severity: "P2",
    status: "resolved",
    description: "Sprain during evening practice. First aid already given.",
    hoursAgo: 28,
  },
  {
    category: "harassment",
    location: "cafe",
    severity: "P1",
    status: "in_progress",
    description: "Verbal harassment near the evening queue. Witnesses present.",
    hoursAgo: 6,
  },
  {
    category: "accident",
    location: "gate",
    severity: "P2",
    status: "resolved",
    description: "Two-wheeler slip at the speed breaker. Minor injuries.",
    hoursAgo: 40,
  },
  {
    category: "ragging",
    location: "hostel-a",
    severity: "P1",
    status: "under_review",
    description: "Senior students blocking corridor access after 11pm.",
    hoursAgo: 22,
  },
  {
    category: "fire",
    location: "science",
    severity: "P3",
    status: "closed",
    description: "Burnt smell from a lab socket. Electrician isolated the circuit.",
    hoursAgo: 70,
  },
];

const SAMPLE_ANON: {
  category: string;
  location: string;
  role: "victim" | "witness" | "heard";
  severity: "P1" | "P2" | "P3" | "P4";
  status: string;
  timeRange: string;
  description: string;
  hoursAgo: number;
  code: string;
}[] = [
  {
    category: "harassment",
    location: "hostel-a",
    role: "witness",
    severity: "P1",
    status: "under_review",
    timeRange: "Last night, 22:00–23:30",
    description: "Shouting from the second-floor corridor. Did not want to be named.",
    hoursAgo: 14,
    code: "CS-7F3K-92QD",
  },
  {
    category: "theft",
    location: "cafe",
    role: "victim",
    severity: "P3",
    status: "reported",
    timeRange: "This morning, 08:00–09:00",
    description: "Wallet taken from an unattended bag near the billing counter.",
    hoursAgo: 5,
    code: "CS-M4NQ-81TX",
  },
  {
    category: "suspicious",
    location: "library",
    role: "heard",
    severity: "P4",
    status: "in_progress",
    timeRange: "Yesterday afternoon",
    description: "Someone asking for hostel room numbers of first-year students.",
    hoursAgo: 30,
    code: "CS-P2LW-55CK",
  },
];

/**
 * Sample campus records for demos. Seeded only on the embedded preview database
 * (no `DATABASE_URL`) or when `SEED_SAMPLE_DATA=true`, so a real production
 * database never receives invented incidents.
 */
function sampleDataEnabled(): boolean {
  return dbSource === "pglite" || process.env.SEED_SAMPLE_DATA?.trim() === "true";
}

export async function ensureSeedData() {
  if (!sampleDataEnabled()) return;
  const sql = await getSql();
  const flag = await sql<{ value: string }>`select value from app_meta where key = ${"seeded"}`;
  if (flag[0]?.value === "1") return;

  const existing = await sql<{ n: number }>`select count(*)::int as n from incidents`;
  if ((existing[0]?.n ?? 0) > 0) {
    await sql`insert into app_meta (key, value) values (${"seeded"}, ${"1"}) on conflict (key) do nothing`;
    return;
  }

  for (const row of SAMPLE_INCIDENTS) {
    const id = newId();
    const occurred = new Date(Date.now() - row.hoursAgo * 3600 * 1000).toISOString();
    const loc = await sql<{ lat: number; lng: number }>`
      select lat, lng from campus_locations where id = ${row.location}
    `;
    await sql`
      insert into incidents (
        id, user_id, category_id, location_id, lat, lng, description, severity, status, occurred_at
      ) values (
        ${id}, ${"seed-campus"}, ${row.category}, ${row.location},
        ${loc[0]?.lat ?? null}, ${loc[0]?.lng ?? null},
        ${row.description}, ${row.severity}, ${row.status}, ${occurred}
      )
    `;
  }

  for (const row of SAMPLE_ANON) {
    const id = newId();
    const created = new Date(Date.now() - row.hoursAgo * 3600 * 1000).toISOString();
    await sql`
      insert into anonymous_reports (
        id, tracking_code, category_id, location_id, role, time_range,
        description, severity, status, photo_stripped, created_at, updated_at
      ) values (
        ${id}, ${row.code}, ${row.category}, ${row.location}, ${row.role}, ${row.timeRange},
        ${row.description}, ${row.severity}, ${row.status}, ${true}, ${created}, ${created}
      )
    `;
    await sql`
      insert into threads (id, kind, subject_id, author_role, author_id, body, created_at)
      values (
        ${newId()}, ${"anonymous"}, ${id}, ${"system"}, ${null},
        ${"Anonymous report received. Identity was never stored."}, ${created}
      )
    `;
  }

  // Spread extra historical incidents for the analytics bars.
  const extras = [
    ["theft", "library", 1],
    ["infra", "lh3", 2],
    ["medical", "sports", 2],
    ["accident", "gate", 3],
    ["suspicious", "parking", 4],
    ["harassment", "cafe", 5],
    ["theft", "hostel-a", 6],
    ["infra", "science", 7],
    ["medical", "medical", 8],
    ["accident", "gate", 9],
    ["theft", "library", 10],
    ["suspicious", "cafe", 11],
  ] as const;
  for (const [category, location, daysAgo] of extras) {
    const occurred = new Date(Date.now() - daysAgo * 86400 * 1000).toISOString();
    const loc = await sql<{ lat: number; lng: number }>`
      select lat, lng from campus_locations where id = ${location}
    `;
    await sql`
      insert into incidents (
        id, user_id, category_id, location_id, lat, lng, description, severity, status, occurred_at
      ) values (
        ${newId()}, ${"seed-campus"}, ${category}, ${location},
        ${loc[0]?.lat ?? null}, ${loc[0]?.lng ?? null},
        ${"Archived campus record."}, ${"P4"}, ${"closed"}, ${occurred}
      )
    `;
  }

  await sql`insert into app_meta (key, value) values (${"seeded"}, ${"1"}) on conflict (key) do nothing`;
}
