import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, LoaderCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { applySessionToken, authClient, authEnabled } from "@/lib/auth/client";
import { postLoginDestination } from "@/lib/roles";
import { getViewer } from "@/backend/functions/viewer";

type SignupSearch = { redirect?: string };

const MIN_PASSWORD_LENGTH = 8;

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  // Already signed in: skip the form.
  beforeLoad: ({ context, search }) => {
    if (context.viewer) {
      throw redirect({
        href: postLoginDestination(context.viewer.role, search.redirect),
        replace: true,
      });
    }
  },
  component: Signup,
});

/** Translate Better Auth failures into plain guidance (never echo raw server detail). */
function signUpErrorMessage(error: { status?: number; code?: string; message?: string }): string {
  if (
    error.code === "USER_ALREADY_EXISTS" ||
    error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    return "An account with that email already exists. Sign in instead.";
  }
  if (error.code === "EMAIL_DOMAIN_NOT_ALLOWED" && error.message) return error.message;
  if (error.code === "PASSWORD_TOO_SHORT")
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (error.code === "INVALID_EMAIL") return "Enter a valid email address.";
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.status === 403)
    return "Sign-up was blocked for this address. Reload the page and try again.";
  if (error.status && error.status >= 500)
    return "The server could not create your account right now. Try again shortly.";
  return error.message || "Sign-up failed. Try again.";
}

/** Embedded previews partition cookies, so the session also rides a bearer token there. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function Signup() {
  const { redirect: redirectTo } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Same hand-off as `/login`: resolve the role on the server, then route. */
  async function enterApp(fallbackToken?: string | null) {
    let viewer = await getViewer();
    if (!viewer && fallbackToken) {
      applySessionToken(fallbackToken);
      viewer = await getViewer();
    }
    if (!viewer) {
      // Account exists but this browser refused the session cookie.
      await navigate({ to: "/login", search: { redirect: redirectTo }, replace: true });
      return;
    }
    await router.invalidate();
    await navigate({ href: postLoginDestination(viewer.role, redirectTo), replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    try {
      let sessionToken: string | null = null;
      const { error: authError } = await authClient.signUp.email(
        { name: trimmedName, email: trimmedEmail, password },
        {
          onSuccess: (ctx) => {
            sessionToken = ctx.response.headers.get("set-auth-token");
            if (sessionToken && isEmbedded()) applySessionToken(sessionToken);
          },
        },
      );
      if (authError) {
        setError(signUpErrorMessage(authError));
        return;
      }
      await enterApp(sessionToken);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Sign-up failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      switchPrompt="Already have an account?"
      switchLabel="Sign in"
      switchTo="/login"
      redirect={redirectTo}
    >
      <h1 className="mb-1 text-center font-display text-2xl font-bold lg:text-left">
        Create your account
      </h1>
      <p className="mb-6 text-center text-sm text-muted lg:text-left">
        Sign up as a student to raise an SOS, report incidents and follow your cases. Staff accounts
        are set up by a campus administrator.
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
          <label htmlFor="signup-name" className="field-label">
            Full name
          </label>
          <input
            id="signup-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="field-label">
            Email address
          </label>
          <input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@campus.edu"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="field-label">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              className="input pr-12"
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
        <div>
          <label htmlFor="signup-confirm" className="field-label">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            className="input"
          />
        </div>
        <button type="submit" disabled={busy || !authEnabled} className="btn-neon w-full">
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}
        </button>
      </form>

      {/* Phones reach sign-in from the header pill. */}
      <p className="mt-6 hidden border-t border-line pt-6 text-center text-sm text-muted lg:block">
        Already have an account?{" "}
        <Link
          to="/login"
          search={{ redirect: redirectTo }}
          className="font-medium text-neon hover:text-fg"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
