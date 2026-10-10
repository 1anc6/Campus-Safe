import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/auth/guards";

/** Responder field app; admins may open it too. Server functions scope responders to their assigned alerts. */
export const Route = createFileRoute("/staff")({
  beforeLoad: requireRole(["responder", "admin"], "forbidden"),
  component: Outlet,
});
