import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CheckCircle, Clock, Percent, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  CategoryDonut,
  DailyBars,
  HotspotBars,
  ReportingDonut,
  ResponseLine,
  SeverityBars,
  StatusDonut,
} from "@/components/shared/charts";
import { getAnalytics, getLive, type AnalyticsPayload } from "@/backend/functions/admin";
import type { LivePayload } from "@/lib/types";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

type Range = "today" | "week" | "month";

function AnalyticsPage() {
  const [live, setLive] = useState<LivePayload | null>(null);
  const [stats, setStats] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    Promise.all([getLive(), getAnalytics()])
      .then(([l, a]) => {
        setLive(l);
        setStats(a);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load analytics"));
  }, []);

  const daily = live?.daily ?? [];
  const sliced = range === "today" ? daily.slice(-1) : range === "week" ? daily.slice(-7) : daily;
  const t = stats?.totals;

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <AdminPageHeader
        title="Analytics"
        subtitle={`Average SOS response ${live?.avgResponseMin ?? 0} min over 14 days`}
        actions={
          <div className="seg" role="group" aria-label="Range">
            {(["today", "week", "month"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                {r === "today" ? "Today" : r === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        }
      />
      {error && (
        <p className="card p-4 text-sm text-sos" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat icon={BarChart3} label="Total reports" value={t?.total} tone="text-neon" />
        <Stat icon={Clock} label="Pending" value={t?.open} tone="text-high" />
        <Stat icon={TrendingUp} label="In progress" value={t?.inProgress} tone="text-warn" />
        <Stat icon={CheckCircle} label="Resolved" value={t?.resolved} tone="text-ok" />
        <Stat
          icon={Percent}
          label="Resolution rate"
          value={t ? `${t.resolutionRate}%` : undefined}
          tone="text-violet"
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card p-4 md:col-span-2 xl:col-span-3">
          <p className="mb-2 text-xs text-muted">Daily volume · today hatched</p>
          <DailyBars data={sliced} />
        </div>
        <Card title="Safety hotspots">
          <HotspotBars data={live?.hotspots ?? []} />
        </Card>
        <Card title="Incidents by category">
          <CategoryDonut data={live?.categories ?? []} />
        </Card>
        <Card title="Severity distribution">
          <SeverityBars data={stats?.severities ?? []} />
        </Card>
        <Card title="Status overview">
          <StatusDonut data={stats?.statuses ?? []} />
        </Card>
        <Card title="Reporting method">
          <ReportingDonut data={stats?.reporting ?? { identified: 0, anonymous: 0, sos: 0 }} />
        </Card>
        <Card title="Trend">
          <ResponseLine data={sliced} />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="mb-2 text-xs text-muted">{title}</p>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  className,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number | string | undefined;
  tone: string;
  className?: string;
}) {
  return (
    <div className={`card p-3 sm:p-4 ${className ?? ""}`}>
      <Icon className={`size-4 ${tone}`} />
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value ?? "–"}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
