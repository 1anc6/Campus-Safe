import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Content column width inside the student shell. */
    width?: "narrow" | "wide" | "full";
  }
}
