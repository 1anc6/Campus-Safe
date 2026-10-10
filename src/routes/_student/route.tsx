import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { StudentShell } from "@/components/student-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Student experience (pathless layout: `/`, `/report`, `/reports/*`). Signed-out
 * visitors go to the shared login; admins and responders are routed to their own
 * home. Pages pick a content width with `staticData.width`.
 */
export const Route = createFileRoute("/_student")({
  beforeLoad: requireRole(["student"]),
  component: StudentLayout,
});

function StudentLayout() {
  const width = useMatches({
    select: (matches) =>
      [...matches].reverse().find((m) => m.staticData.width)?.staticData.width ?? "wide",
  });
  return (
    <StudentShell width={width}>
      <Outlet />
    </StudentShell>
  );
}
