import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { SignOutButton } from "@/components/shared/account-menu";
import { useViewer } from "@/lib/auth/use-viewer";
import { homeForRole, roleLabel } from "@/lib/roles";

export const Route = createFileRoute("/forbidden")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  head: () => ({ meta: [{ title: "No access" }] }),
  component: Forbidden,
});

function Forbidden() {
  const viewer = useViewer();
  const { from } = Route.useSearch();
  const home = viewer ? homeForRole(viewer.role) : "/login";
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-10 text-center">
      <div className="card flex w-full max-w-md flex-col items-center p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-sos/10 ring-1 ring-sos/30">
          <ShieldOff className="size-7 text-sos" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold">You don't have access</h1>
        <p className="mt-2 text-sm text-muted">
          {from ? (
            <>
              <span className="font-mono text-fg">{from}</span> is limited to campus administrators.
            </>
          ) : (
            "That area is limited to campus administrators."
          )}
          {viewer && <> You're signed in as a {roleLabel(viewer.role).toLowerCase()}.</>}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
          <Link to={home} className="btn-neon flex-1">
            Go to my home
          </Link>
          {viewer && <SignOutButton className="btn-ghost flex-1 justify-center" />}
        </div>
      </div>
    </main>
  );
}
