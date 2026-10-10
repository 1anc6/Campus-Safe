import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { applySessionToken, authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BRAND } from "@/lib/brand";
import { postLoginDestination } from "@/lib/roles";
import { getViewer, prepareSignIn } from "@/backend/functions/viewer";
import { forgetViewer } from "@/lib/auth/viewer-cache";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  // Already signed in (direct URL, refresh, back button): skip the form.
  beforeLoad: ({ context, search }) => {
    if (context.viewer) {
      throw redirect({
        href: postLoginDestination(context.viewer.role, search.redirect),
        replace: true,
      });
    }
  },
  // Ensure operator-configured bootstrap accounts exist; never block the form on it.
  loader: () => prepareSignIn().catch(() => ({ ok: false as const })),
  component: Login,
});

/** Translate Better Auth failures into plain guidance (never echo raw server detail). */
function signInErrorMessage(error: { status?: number; code?: string; message?: string }): string {
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Incorrect email or password.";
  }
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.status === 403)
    return "Sign-in was blocked for this address. Reload the page and try again.";
  if (error.status && error.status >= 500)
    return "The server could not sign you in right now. Try again shortly.";
  return error.message || "Sign-in failed. Try again.";
}

/** Inside an iframe cookies are partitioned, so the session also rides a bearer token there. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function Login() {
  const { redirect: redirectTo } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Resolve the role on the server, refresh guards, then go to the right experience.
   * `fallbackToken`: the session token from sign-in, used only when the browser
   * refused the Secure session cookie (plain-http LAN address, or inside an iframe).
   */
  async function enterApp(fallbackToken?: string | null) {
    let viewer = await getViewer();
    if (!viewer && fallbackToken) {
      applySessionToken(fallbackToken);
      viewer = await getViewer();
    }
    if (!viewer) {
      throw new Error(
        "Signed in, but this browser blocked the session. Open the app at http://localhost:8080 or over HTTPS.",
      );
    }
    forgetViewer();
    await router.invalidate();
    await navigate({ href: postLoginDestination(viewer.role, redirectTo), replace: true });
  }

  // A session the server render could not see (bearer-token fallback).
  useEffect(() => {
    if (isPending || !user || busy) return;
    void enterApp().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once the client session resolves
  }, [isPending, user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      let sessionToken: string | null = null;
      const { error: authError } = await authClient.signIn.email(
        { email: trimmed, password },
        {
          onSuccess: (ctx) => {
            sessionToken = ctx.response.headers.get("set-auth-token");
            if (sessionToken && isEmbedded()) applySessionToken(sessionToken);
          },
        },
      );
      if (authError) {
        setError(signInErrorMessage(authError));
        return;
      }
      await enterApp(sessionToken);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Sign-in failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      switchPrompt="Don't have an account?"
      switchLabel="Sign up"
      switchTo="/signup"
      redirect={redirectTo}
    >
      <h1 className="mb-1 text-center font-display text-2xl font-bold lg:text-left">
        Welcome back
      </h1>
      <p className="mb-6 text-center text-sm text-muted lg:text-left">
        Sign in with your campus account. Students and staff use the same page.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg bg-sos/10 p-3 text-sm text-sos ring-1 ring-sos/40"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="field-label">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@campus.edu"
            className="input"
            aria-invalid={Boolean(error)}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="field-label">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input pr-12"
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-dim hover:text-fg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={busy || !authEnabled} className="btn-auth mt-2 w-full">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs leading-relaxed text-dim">
          Forgot your password? Ask a campus administrator to reset it.
        </p>
      </form>

      {/* Phones reach sign-up from the header pill. */}
      <div className="mt-6 hidden border-t border-line pt-6 lg:block">
        <p className="mb-3 text-center text-sm text-muted">New to {BRAND.name}?</p>
        <Link to="/signup" search={{ redirect: redirectTo }} className="btn-ghost w-full">
          <UserPlus className="size-4" />
          Create an account
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs text-dim">
        <span className="h-px flex-1 bg-[var(--auth-field-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--auth-field-border)]" />
      </div>
      <Link
        to="/anonymous"
        className="mt-4 flex min-h-12 items-center gap-3 rounded-[14px] border border-[var(--auth-field-border)] bg-[var(--auth-field)] px-4 text-left transition-colors hover:border-[var(--auth-link)]"
      >
        <EyeOff className="size-[18px] shrink-0 text-[var(--auth-link)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">File an anonymous report</span>
          <span className="block text-xs text-dim">No account needed</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-dim" />
      </Link>
    </AuthLayout>
  );
}
