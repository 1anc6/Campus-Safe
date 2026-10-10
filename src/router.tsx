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
    // Start loading a page's code and checks as soon as the pointer hovers (or a
    // finger touches) its link, so it's ready by the time the click lands.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Cross-fade between pages (View Transitions API; ignored where unsupported).
    defaultViewTransition: true,
    scrollRestoration: true,
  });
}
