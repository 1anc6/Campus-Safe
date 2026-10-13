import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Skeleton } from "@/components/shared/skeleton";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Admin analytics charts in the liquid-glass style: gradient fills that fade
 * toward the baseline, rounded marks, faint dashed grids and frosted tooltips.
 */

/** Chart colours per theme (SVG attributes can't read CSS variables). */
const CHART_COLORS = {
  light: {
    axis: "#5E6B7E",
    grid: "rgba(27,36,48,.09)",
    track: "rgba(148,163,184,.16)",
    cursor: "rgba(0,207,232,.08)",
    accent: "#00A9C2",
    accent2: "#6A55D6",
    categorical: ["#00A9C2", "#6A55D6", "#D98A00", "#00826C", "#C2410C", "#77849A"],
    severity: { P1: "#E0354A", P2: "#C2410C", P3: "#D98A00", P4: "#00826C" } as Record<
      string,
      string
    >,
    status: {
      reported: "#00A9C2",
      under_review: "#6A55D6",
      in_progress: "#D98A00",
      resolved: "#00826C",
      closed: "#77849A",
    } as Record<string, string>,
    sos: "#E0354A",
    violet: "#6A55D6",
  },
  dark: {
    axis: "#9A968C",
    grid: "rgba(232,224,210,.1)",
    track: "rgba(255,248,240,.05)",
    cursor: "rgba(217,119,87,.08)",
    accent: "#E8936F",
    accent2: "#A594F9",
    categorical: ["#E8936F", "#A594F9", "#E9B45A", "#6BC99A", "#7FB4D9", "#9A968C"],
    severity: { P1: "#F2555C", P2: "#EE8650", P3: "#E9B45A", P4: "#6BC99A" } as Record<
      string,
      string
    >,
    status: {
      reported: "#E8936F",
      under_review: "#A594F9",
      in_progress: "#E9B45A",
      resolved: "#6BC99A",
      closed: "#9A968C",
    } as Record<string, string>,
    sos: "#F2555C",
    violet: "#A594F9",
  },
};

function useChartColors() {
  return CHART_COLORS[useTheme()];
}

const ANIM = { animationDuration: 700, animationEasing: "ease-out" as const };
const tick = (fill: string) => ({ fill, fontSize: 11 });

/** Vertical gradient (strong at the top, fading to the baseline). */
function FadeGradient({
  id,
  color,
  from = 0.95,
  to = 0.25,
  horizontal = false,
}: {
  id: string;
  color: string;
  from?: number;
  to?: number;
  horizontal?: boolean;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
      <stop offset="0%" stopColor={color} stopOpacity={horizontal ? to : from} />
      <stop offset="100%" stopColor={color} stopOpacity={horizontal ? from : to} />
    </linearGradient>
  );
}

/** Frosted-glass tooltip. */
function GlassTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: TooltipProps<number, string> & {
  labelFormatter?: (label: unknown, payload: unknown[]) => string;
}) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter ? labelFormatter(label, payload) : (label ?? payload[0]?.name);
  return (
    <div className="glass-bar rounded-2xl px-3 py-2 text-xs">
      {title != null && title !== "" && (
        <p className="mb-1 font-medium text-muted">{String(title)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{
              background: (p.payload as { fill?: string })?.fill ?? p.color ?? "currentColor",
            }}
          />
          <span className="text-muted">{p.name === "count" ? "Reports" : p.name}</span>
          <span className="ml-auto pl-3 font-display font-semibold tabular-nums text-fg">
            {p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ bars */

export function DailyBars({ data }: { data: { day: string; count: number; isToday: boolean }[] }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, "");
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barCategoryGap="26%"
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <FadeGradient id={`${id}-bar`} color={c.accent} from={0.85} to={0.18} />
            <FadeGradient id={`${id}-today`} color={c.accent2} from={1} to={0.35} />
          </defs>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => d.slice(5)}
            tick={tick(c.axis)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={tick(c.axis)}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<GlassTooltip />} cursor={{ fill: c.cursor, radius: 10 } as never} />
          <Bar dataKey="count" name="Reports" radius={[10, 10, 4, 4]} {...ANIM}>
            {data.map((d) => (
              <Cell
                key={d.day}
                fill={d.isToday ? `url(#${id}-today)` : `url(#${id}-bar)`}
                style={d.isToday ? { filter: `drop-shadow(0 0 10px ${c.accent2}66)` } : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HotspotBars({ data }: { data: { name: string; count: number }[] }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, "");
  if (!data.some((d) => d.count > 0)) return <EmptyChart />;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
          <defs>
            <FadeGradient id={`${id}-h`} color={c.accent} from={1} to={0.35} horizontal />
          </defs>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={tick(c.axis)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<GlassTooltip />} cursor={false} />
          <Bar
            dataKey="count"
            name="Reports"
            fill={`url(#${id}-h)`}
            radius={999}
            barSize={10}
            background={{ fill: c.track, radius: 999 } as never}
            {...ANIM}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const SEVERITY_LABELS: Record<string, string> = {
  P1: "Critical",
  P2: "High",
  P3: "Medium",
  P4: "Low",
};

export function SeverityBars({ data }: { data: { severity: string; count: number }[] }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, "");
  if (!data.some((d) => d.count > 0)) return <EmptyChart />;
  const rows = data.map((d) => ({
    ...d,
    name: `${d.severity} ${SEVERITY_LABELS[d.severity] ?? ""}`,
  }));
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap="32%" margin={{ top: 8 }}>
          <defs>
            {rows.map((d) => (
              <FadeGradient
                key={d.severity}
                id={`${id}-${d.severity}`}
                color={c.severity[d.severity] ?? c.axis}
              />
            ))}
          </defs>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="severity" tick={tick(c.axis)} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={tick(c.axis)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <GlassTooltip
                labelFormatter={(_, p) =>
                  (p as { payload?: { name?: string } }[])?.[0]?.payload?.name ?? ""
                }
              />
            }
            cursor={{ fill: c.cursor, radius: 10 } as never}
          />
          <Bar dataKey="count" name="Reports" radius={[10, 10, 4, 4]} {...ANIM}>
            {rows.map((d) => (
              <Cell key={d.severity} fill={`url(#${id}-${d.severity})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ trend */

export function ResponseLine({ data }: { data: { day: string; count: number }[] }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, "");
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
          <defs>
            <FadeGradient id={`${id}-area`} color={c.accent} from={0.4} to={0} />
            <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c.accent2} />
              <stop offset="100%" stopColor={c.accent} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="day" hide />
          <YAxis hide />
          <Tooltip content={<GlassTooltip />} cursor={{ stroke: c.grid, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            name="Reports"
            stroke={`url(#${id}-stroke)`}
            strokeWidth={2.5}
            fill={`url(#${id}-area)`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 3, stroke: c.accent, fill: "#fff" }}
            {...ANIM}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------------------- donuts */

/** Legend with label + count beside each swatch, so identity never relies on colour alone. */
function ValueLegend({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: i.color, boxShadow: `0 0 8px ${i.color}55` }}
            aria-hidden="true"
          />
          <span className="truncate text-muted">{i.label}</span>
          <span className="ml-auto font-mono tabular-nums text-fg">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart() {
  return <p className="grid h-44 place-items-center text-xs text-muted">No data yet</p>;
}

/** Donut with rounded segments and the total in the middle. */
function GlassDonut({
  items,
  height = "h-40",
  legend = true,
}: {
  items: { label: string; value: number; color: string }[];
  height?: string;
  legend?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (!items.some((i) => i.value > 0)) return <EmptyChart />;
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <>
      <div className={cn("relative", height)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {items.map((i, n) => (
                <linearGradient key={i.label} id={`${id}-${n}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={i.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={i.color} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={4}
              cornerRadius={8}
              stroke="none"
              {...ANIM}
            >
              {items.map((i, n) => (
                <Cell key={i.label} fill={`url(#${id}-${n})`} />
              ))}
            </Pie>
            <Tooltip content={<GlassTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums leading-none">{total}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Total</p>
          </div>
        </div>
      </div>
      {legend && <ValueLegend items={items} />}
    </>
  );
}

export function CategoryDonut({ data }: { data: { name: string; count: number }[] }) {
  const c = useChartColors();
  return (
    <GlassDonut
      items={data.map((d, i) => ({
        label: d.name,
        value: d.count,
        color: c.categorical[i % c.categorical.length]!,
      }))}
    />
  );
}

/** Same hues as the status pills, so a state reads the same everywhere. */
const STATUS_ORDER = [
  { id: "reported", label: "Reported" },
  { id: "under_review", label: "Under review" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  const c = useChartColors();
  return (
    <GlassDonut
      items={STATUS_ORDER.map((s) => ({
        label: s.label,
        color: c.status[s.id]!,
        value: data.find((d) => d.status === s.id)?.count ?? 0,
      }))}
    />
  );
}

export function ReportingDonut({
  data,
}: {
  data: { identified: number; anonymous: number; sos: number };
}) {
  const c = useChartColors();
  return (
    <GlassDonut
      items={[
        { label: "Identified", value: data.identified, color: c.accent },
        { label: "Anonymous", value: data.anonymous, color: c.violet },
        { label: "SOS", value: data.sos, color: c.sos },
      ]}
    />
  );
}

/* --------------------------------------------------------------- loading */

/** Chart-shaped shimmer while data loads. */
export function ChartSkeleton({
  donut,
  bars = "vertical",
  tall,
}: {
  donut?: boolean;
  bars?: "vertical" | "horizontal";
  tall?: boolean;
}) {
  if (donut) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading chart"
        className="flex flex-col items-center gap-4 py-2"
      >
        <span className="skeleton size-32 rounded-full [mask:radial-gradient(circle,transparent_56%,#000_57%)]" />
        <div className="grid w-full grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
      </div>
    );
  }
  if (bars === "horizontal") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading chart"
        className="flex h-44 flex-col justify-center gap-3"
      >
        {[85, 65, 50, 35, 20].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-24 shrink-0" />
            <span className="skeleton h-2.5 rounded-full" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  const heights = tall ? [40, 65, 50, 80, 55, 90, 70] : [45, 70, 35, 85, 60];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading chart"
      className={cn("flex items-end gap-[6%] px-2 pb-1", tall ? "h-56" : "h-44")}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="skeleton flex-1 rounded-t-[10px] rounded-b-md"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
