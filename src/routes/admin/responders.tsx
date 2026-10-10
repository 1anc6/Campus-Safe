import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin-shell";
import { listResponders } from "@/lib/server/admin";
import type { Responder } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/responders")({ component: RespondersPage });

const STATUS_TONE: Record<Responder["status"], string> = {
  available: "bg-ok/15 text-ok",
  on_duty: "bg-warn/15 text-warn",
  off_duty: "bg-muted/20 text-muted",
};

function RespondersPage() {
  const [units, setUnits] = useState<Responder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listResponders()
      .then(setUnits)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load units"));
  }, []);

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="Responder units"
        subtitle={
          <>
            Units command can dispatch. Give a person the responder role on the{" "}
            <Link to="/admin/users" className="text-neon hover:underline">
              Users
            </Link>{" "}
            page to add them here.
          </>
        }
      />
      {error && (
        <p className="card p-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {units?.map((u) => (
          <li key={u.id} className="card flex flex-col gap-2 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 ring-1 ring-line">
                <Truck className="size-4 text-neon" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-sm text-muted">{u.unit}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", STATUS_TONE[u.status])}>
                {u.status.replace("_", " ")}
              </span>
            </div>
            {u.phone && (
              <a href={`tel:${u.phone.replaceAll(" ", "")}`} className="inline-flex min-h-10 items-center gap-1.5 text-xs text-muted hover:text-neon">
                <Phone className="size-3.5" /> {u.phone}
              </a>
            )}
          </li>
        ))}
      </ul>
      {units?.length === 0 && <p className="card p-6 text-sm text-muted">No responder units yet.</p>}
    </div>
  );
}
