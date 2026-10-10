import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BrandMark } from "@/components/brand";
import { BRAND } from "@/lib/brand";
import { getViewer } from "@/lib/server/viewer";
import { THEME_BOOT_SCRIPT, useTheme } from "@/lib/theme";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // The verified viewer (role from the database) for every route guard below.
  // A failed lookup is treated as signed out rather than crashing the page.
  beforeLoad: async () => ({ viewer: await getViewer().catch(() => null) }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: BRAND.name },
      { name: "theme-color", content: "#f3f5f8" },
      { name: "description", content: BRAND.description },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Space+Grotesk:wght@500;600;700&display=swap",
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
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Toaster
            theme={theme}
            position="top-center"
            toastOptions={{
              style: {
                background: "var(--color-panel)",
                border: "1px solid var(--color-line)",
                color: "var(--color-fg)",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
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
