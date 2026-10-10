import { redirect, type ParsedLocation } from "@tanstack/react-router";
import type { UserRole } from "@/lib/campus";
import { homeForRole } from "@/lib/roles";
import type { Profile } from "@/lib/types";

/**
 * Route guards for `beforeLoad`. They read `context.viewer`, which the root route
 * resolves from the server (`getViewer`) on every navigation — during SSR for
 * direct URLs and refreshes, and on the client for in-app navigation — so a guard
 * never trusts client state. Server functions enforce the same roles again.
 */

type GuardArgs = {
  context: { viewer: Profile | null };
  location: ParsedLocation;
};

/** Signed-out visitors go to the shared login, remembering where they were headed. */
function requireViewer({ context, location }: GuardArgs): Profile {
  if (!context.viewer) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  return context.viewer;
}

/**
 * Restrict a route to `roles`. A signed-in viewer without the role is sent to
 * `/forbidden` when `deny` is "forbidden" (protected areas like the admin
 * console), or quietly to their own home when "home" (the wrong experience, e.g.
 * an admin opening the student home).
 */
export function requireRole(roles: readonly UserRole[], deny: "forbidden" | "home" = "home") {
  return (args: GuardArgs) => {
    const viewer = requireViewer(args);
    if (roles.includes(viewer.role)) return { viewer };
    if (deny === "forbidden") {
      throw redirect({ to: "/forbidden", search: { from: args.location.pathname } });
    }
    throw redirect({ href: homeForRole(viewer.role) });
  };
}
