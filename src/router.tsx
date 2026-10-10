import { createRouter } from "@tanstack/react-router";
import { BootScreen } from "@/components/auth/auth-gate";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Shown while guards resolve the session on slow connections.
    defaultPendingComponent: BootScreen,
    defaultPendingMs: 400,
    scrollRestoration: true,
  });
}
