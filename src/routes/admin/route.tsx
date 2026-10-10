import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Admin operations console. The guard runs on the server for direct URLs and
 * refreshes and on the client for in-app navigation; non-admins are sent to
 * /forbidden. Every admin server function re-checks the role (`requireAdmin`).
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: requireRole(["admin"], "forbidden"),
  head: () => ({ meta: [{ title: "Operations console · CampusSafe" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
