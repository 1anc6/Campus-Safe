import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { BrandMark } from "@/components/shared/brand";
import { BRAND } from "@/lib/brand";
import site from "@/lib/og/site.json";
import { getViewer } from "@/backend/functions/viewer";
import { rememberedViewer, rememberViewer } from "@/lib/auth/viewer-cache";
import { THEME_BOOT_SCRIPT, useTheme } from "@/lib/theme";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // The verified viewer (role from the database) for every route guard below.
  // A failed lookup is treated as signed out rather than crashing the page.
  // In the browser, a recent answer is reused (30 s) so page switches are
  // instant; the server re-checks the session on every data call regardless.
  beforeLoad: async () => {
    const isBrowser = typeof window !== "undefined";
    const remembered = isBrowser ? rememberedViewer() : null;
    if (remembered) return { viewer: remembered };
    const viewer = await getViewer().catch(() => null);
    if (isBrowser) rememberViewer(viewer);
    return { viewer };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: BRAND.name },
      { name: "theme-color", content: "#e4ecf7" },
      { name: "description", content: BRAND.description },
      // Installable web app (Add to Home Screen) on iOS.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: BRAND.name },
      // Link preview card (WhatsApp, X, Slack…): src/lib/og/site.json + public/og.jpg.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:title", content: site.title },
      { property: "og:description", content: site.description },
      { property: "og:image", content: "/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: site.title },
      { name: "twitter:description", content: site.description },
      { name: "twitter:image", content: "/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Manrope:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument() {
  const theme = useTheme();
  return (
    <html lang="en" className="antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint (no flash of the wrong theme). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="bg-bg text-fg min-h-dvh">
        <AuthProvider>
          <Outlet />
          <Toaster theme={theme} position="top-center" gap={10} />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <BrandMark size="lg" />
        <p className="mt-6 font-display text-2xl font-semibold">Page not found</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          That link does not lead anywhere. Head back and pick up where you left off.
        </p>
        <Link to="/" className="btn-neon mt-6">
          Go home
        </Link>
      </div>
    </main>
  );
}
