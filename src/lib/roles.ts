import type { UserRole } from "./campus";

/**
 * Single source of truth for role-based routing. Client-safe (no server imports):
 * route guards, the login redirect and the shells all read from here, while the
 * server enforces the same roles independently in `src/lib/server/helpers.ts`.
 */

/** Where each role lands after sign-in (and when visiting `/`). */
export const ROLE_HOME: Record<UserRole, string> = {
  student: "/",
  responder: "/staff",
  admin: "/admin",
};

export function homeForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

export function roleLabel(role: UserRole): string {
  return role === "admin" ? "Admin" : role === "responder" ? "Responder" : "Student";
}

/** Path areas and the roles allowed in them. Public paths are not listed. */
const AREAS: { prefix: string; roles: readonly UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/staff", roles: ["responder", "admin"] },
  { prefix: "/sos", roles: ["student"] },
  { prefix: "/reports", roles: ["student"] },
  { prefix: "/report", roles: ["student"] },
];

const PUBLIC_PREFIXES = ["/login", "/signup", "/anonymous", "/track", "/forbidden"];

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Whether `role` may open `path` (pathname only, no query/hash). */
export function canAccessPath(role: UserRole, path: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => matches(path, p))) return true;
  if (path === "/") return role === "student";
  const area = AREAS.find((a) => matches(path, a.prefix));
  return area ? area.roles.includes(role) : true;
}

/**
 * Validate a post-login `redirect` value: same-origin relative paths only (no
 * `//host`, no scheme), never back to `/login` or `/signup`. Returns `null` when unusable.
 */
export function sanitizeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  const pathname = raw.split(/[?#]/, 1)[0] ?? "";
  if (matches(pathname, "/login") || matches(pathname, "/signup")) return null;
  return raw;
}

/** Destination after sign-in: the requested page when the role may open it, else the role's home. */
export function postLoginDestination(role: UserRole, redirect: unknown): string {
  const target = sanitizeRedirect(redirect);
  if (target) {
    const pathname = target.split(/[?#]/, 1)[0] ?? "";
    if (canAccessPath(role, pathname)) return target;
  }
  return homeForRole(role);
}
