import { useRouteContext } from "@tanstack/react-router";
import type { Profile } from "@/lib/types";

/**
 * The verified signed-in viewer (profile + role) as resolved by the root route for
 * the current navigation, or `null` when signed out. Display only — access control
 * lives in route guards and server functions.
 */
export function useViewer(): Profile | null {
  return useRouteContext({ from: "__root__", select: (c) => c.viewer });
}
