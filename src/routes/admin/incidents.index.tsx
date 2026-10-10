import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock, Filter, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SeverityChip, StatusPill } from "@/components/shared/pills";
import { CATEGORIES, INCIDENT_STATUSES, SEVERITIES, type Severity } from "@/lib/campus";
import { listIncidentsAdmin } from "@/backend/functions/admin";
import { cn, formatClock } from "@/lib/utils";
import { SkeletonList } from "@/components/shared/skeleton";

type IncidentSearch = {
  q?: string;
  status?: string;
  severity?: Severity;
  category?: string;
  sort?: "priority" | "date";
};

const SEVERITY_IDS = new Set<string>(SEVERITIES.map((s) => s.id));

export const Route = createFileRoute("/admin/incidents/")({
  validateSearch: (s: Record<string, unknown>): IncidentSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    status: typeof s.status === "string" && s.status ? s.status : undefined,
    severity:
      typeof s.severity === "string" && SEVERITY_IDS.has(s.severity)
        ? (s.severity as Severity)
        : undefined,
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    sort: s.sort === "date" ? "date" : undefined,
  }),
  component: IncidentsPage,
});

type Row = Awaited<ReturnType<typeof listIncidentsAdmin>>[number];

const SEV_TILE: Record<Severity, string> = {
  P1: "bg-sos/15 text-sos",
  P2: "bg-high/15 text-high",
  P3: "bg-warn/15 text-warn",
  P4: "bg-ok/15 text-ok",
};

function IncidentsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState(search.q ?? "");
  const [showFilters, setShowFilters] = useState(
    Boolean(search.status || search.severity || search.category),
  );

  useEffect(() => {
    listIncidentsAdmin()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load incidents"));
  }, []);

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((search.q ?? "") !== term) {
        void navigate({ search: (prev) => ({ ...prev, q: term || undefined }), replace: true });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [term, search.q, navigate]);

  const setFilter = (patch: Partial<IncidentSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = (search.q ?? "").toLowerCase();
    const out = rows.filter(
      (r) =>
        (!q ||
          [r.categoryName, r.description, r.locationName, r.reporterName].some((v) =>
            v.toLowerCase().includes(q),
          )) &&
        (!search.status || r.status === search.status) &&
        (!search.severity || r.severity === search.severity) &&
        (!search.category || r.categoryId === search.category),
    );
    return out.sort((a, b) =>
      search.sort === "date"
        ? +new Date(b.createdAt) - +new Date(a.createdAt)
        : a.severity.localeCompare(b.severity) || +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }, [rows, search]);

  const activeFilters = [search.status, search.severity, search.category].filter(Boolean).length;

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="All incidents"
        subtitle={rows ? `${filtered.length} of ${rows.length} incidents` : "Loading…"}
      />

      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search category, place, reporter, details…"
              className="input pl-10"
              aria-label="Search incidents"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={search.sort ?? "priority"}
              onChange={(e) => setFilter({ sort: e.target.value === "date" ? "date" : undefined })}
              className="input w-auto flex-1 sm:flex-none"
              aria-label="Sort"
            >
              <option value="priority">Sort by priority</option>
              <option value="date">Sort by date</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={cn("btn-ghost", showFilters && "border-neon/40 bg-neon-dim text-neon")}
            >
              <Filter className="size-4" />
              Filters{activeFilters > 0 && ` (${activeFilters})`}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-3">
            <label>
              <span className="field-label">Status</span>
              <select
                value={search.status ?? ""}
                onChange={(e) => setFilter({ status: e.target.value || undefined })}
                className="input"
              >
                <option value="">All statuses</option>
                {INCIDENT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Priority</span>
              <select
                value={search.severity ?? ""}
                onChange={(e) =>
                  setFilter({ severity: (e.target.value || undefined) as Severity | undefined })
                }
                className="input"
              >
                <option value="">All priorities</option>
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Category</span>
              <select
                value={search.category ?? ""}
                onChange={(e) => setFilter({ category: e.target.value || undefined })}
                className="input"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFilter({ status: undefined, severity: undefined, category: undefined })
                }
                className="flex min-h-10 items-center justify-center gap-1 text-sm text-sos hover:underline sm:col-span-3"
              >
                <X className="size-3.5" /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="card p-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}

      {rows && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <Search className="mx-auto size-8 text-dim" />
          <p className="mt-3 font-medium">No incidents match</p>
          <p className="mt-1 text-sm text-muted">Try a different search or clear the filters.</p>
        </div>
      )}

      {!rows && <SkeletonList rows={6} />}
      <ul className="space-y-2.5">
        {filtered.map((inc) => (
          <li key={inc.id}>
            <Link
              to="/admin/incidents/$id"
              params={{ id: inc.id }}
              className="card group flex gap-3 p-4 transition-colors hover:bg-panel-2 sm:gap-4"
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold",
                  SEV_TILE[inc.severity],
                )}
              >
                {inc.severity}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium group-hover:text-neon">{inc.categoryName}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{inc.description}</p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-dim group-hover:text-neon" />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <SeverityChip value={inc.severity} />
                  <StatusPill status={inc.status} />
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3" /> {inc.locationName}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3" /> {formatClock(inc.createdAt)}
                  </span>
                  <span className="text-xs text-dim">{inc.reporterName}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
