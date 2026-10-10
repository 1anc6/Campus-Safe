import { getSql } from "@/backend/db";
import { CATEGORIES, LOCATIONS, type UserRole } from "@/lib/campus";
import { iso, newId } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type ProfileRow = {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
};

async function selectProfile(userId: string): Promise<ProfileRow | undefined> {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`
    select user_id, name, email, phone, role, avatar_url from profiles where user_id = ${userId}
  `;
  return rows[0];
}

/**
 * The caller's profile, created on first sign-in. New accounts are always
 * `student`; elevated roles are granted only by an admin (Users page) or by the
 * server-side bootstrap account config — never inferred from sign-up order or email.
 */
export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const existing = await selectProfile(userId);
  if (existing) return mapProfile(existing);

  const sql = await getSql();
  const users = await sql<{
    name: string;
    email: string | null;
    image: string | null;
  }>`select name, email, image from "user" where id = ${userId}`;
  const u = users[0];
  const name = u?.name?.trim() || "Campus member";
  await sql`
    insert into profiles (user_id, name, email, role, avatar_url)
    values (${userId}, ${name}, ${u?.email ?? null}, ${"student"}, ${u?.image ?? null})
    on conflict (user_id) do nothing
  `;
  const created = await selectProfile(userId);
  if (!created) throw new Error("Could not create profile");
  return mapProfile(created);
}

/** Staff need a responder unit row so command can dispatch them. */
export async function ensureResponderUnit(userId: string, name: string, role: UserRole) {
  if (role === "student") return;
  const sql = await getSql();
  await sql`
    insert into responders (id, name, unit, phone, user_id, status)
    values (
      ${"self-" + userId}, ${name}, ${role === "admin" ? "Command" : "Patrol"},
      ${null}, ${userId}, ${"available"}
    )
    on conflict (id) do update set user_id = excluded.user_id, name = excluded.name
  `;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatar_url,
  };
}

export async function requireStaff(userId: string): Promise<Profile> {
  const profile = await getOrCreateProfile(userId);
  if (profile.role !== "admin" && profile.role !== "responder") {
    throw new Error("Forbidden");
  }
  return profile;
}

export async function requireAdmin(userId: string): Promise<Profile> {
  const profile = await getOrCreateProfile(userId);
  if (profile.role !== "admin") throw new Error("Forbidden");
  return profile;
}

export async function audit(
  actorId: string | null,
  action: string,
  subjectKind?: string,
  subjectId?: string,
  detail?: string,
) {
  const sql = await getSql();
  await sql`
    insert into audit_log (id, actor_id, action, subject_kind, subject_id, detail)
    values (${newId()}, ${actorId}, ${action}, ${subjectKind ?? null}, ${subjectId ?? null}, ${detail ?? null})
  `;
}

export async function addSystemMessage(
  kind: "sos" | "incident" | "anonymous",
  subjectId: string,
  body: string,
) {
  const sql = await getSql();
  await sql`
    insert into threads (id, kind, subject_id, author_role, author_id, body)
    values (${newId()}, ${kind}, ${subjectId}, ${"system"}, ${null}, ${body})
  `;
}

export function locName(id: string | null | undefined): string {
  return LOCATIONS.find((l) => l.id === id)?.name ?? "Unknown location";
}

export function catName(id: string | null | undefined): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? "Incident";
}

export function locCoords(id: string | null | undefined) {
  const loc = LOCATIONS.find((l) => l.id === id);
  return loc ? { lat: loc.lat, lng: loc.lng } : { lat: null, lng: null };
}

export { iso };
