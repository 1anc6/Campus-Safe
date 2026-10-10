import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "@/lib/theme";

/** Chart colours per theme (SVG attributes can't read CSS variables). */
const CHART_COLORS = {
  light: {
    axis: "#5E6B7E",
    grid: "rgba(27,36,48,.08)",
    cursor: "rgba(0,207,232,.10)",
    accent: "#00A9C2",
    panel: "#FFFFFF",
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
    axis: "#8A94A6",
    grid: "rgba(148,163,184,.12)",
    cursor: "rgba(53,224,255,.06)",
    accent: "#35E0FF",
    panel: "#0D1524",
    categorical: ["#35E0FF", "#8B7CFF", "#FFB020", "#2FE6A8", "#FF7A45", "#8A94A6"],
    severity: { P1: "#FF3B4E", P2: "#FF7A45", P3: "#FFB020", P4: "#2FE6A8" } as Record<
      string,
      string
    >,
    status: {
      reported: "#35E0FF",
      under_review: "#8B7CFF",
      in_progress: "#FFB020",
      resolved: "#2FE6A8",
      closed: "#8A94A6",
    } as Record<string, string>,
    sos: "#FF3B4E",
    violet: "#8B7CFF",
  },
};

function useChartColors() {
  return CHART_COLORS[useTheme()];
}

const tooltipStyle = {
  background: "var(--color-panel)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  color: "var(--color-fg)",
  fontSize: 12,
  boxShadow: "var(--card-shadow)",
};

export function DailyBars({ data }: { data: { day: string; count: number; isToday: boolean }[] }) {
  const c = useChartColors();
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fill: c.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: c.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.cursor }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.day}
                fill={d.isToday ? "url(#hatch)" : c.accent}
                fillOpacity={d.isToday ? 1 : 0.85}
              />
            ))}
          </Bar>
          <defs>
            <pattern
              id="hatch"
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(-45)"
            >
              <rect width="6" height="6" fill={c.panel} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={c.accent} strokeWidth="3" />
            </pattern>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HotspotBars({ data }: { data: { name: string; count: number }[] }) {
  const c = useChartColors();
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: c.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill={c.accent} radius={[0, 6, 6, 0]} barSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({ data }: { data: { name: string; count: number }[] }) {
  const c = useChartColors();
  const colors = c.categorical;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            innerRadius={42}
            outerRadius={64}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponseLine({ data }: { data: { day: string; count: number }[] }) {
  const c = useChartColors();
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="day" hide />
          <YAxis hide />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="count" stroke={c.accent} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend with label + count beside each swatch, so identity never relies on color alone. */
function ValueLegend({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ background: i.color }}
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

const SEVERITY_LABELS: Record<string, string> = {
  P1: "Critical",
  P2: "High",
  P3: "Medium",
  P4: "Low",
};

export function SeverityBars({ data }: { data: { severity: string; count: number }[] }) {
  const c = useChartColors();
  if (!data.some((d) => d.count > 0)) return <EmptyChart />;
  const rows = data.map((d) => ({
    ...d,
    name: `${d.severity} ${SEVERITY_LABELS[d.severity] ?? ""}`,
  }));
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap="30%">
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="severity"
            tick={{ fill: c.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fill: c.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: c.cursor }}
            labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""}
          />
          <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]}>
            {rows.map((d) => (
              <Cell key={d.severity} fill={c.severity[d.severity] ?? c.axis} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
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

function LabeledDonut({ items }: { items: { label: string; value: number; color: string }[] }) {
  const c = useChartColors();
  if (!items.some((i) => i.value > 0)) return <EmptyChart />;
  return (
    <>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius={38}
              outerRadius={60}
              paddingAngle={2}
              stroke={c.panel}
              strokeWidth={2}
            >
              {items.map((i) => (
                <Cell key={i.label} fill={i.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ValueLegend items={items} />
    </>
  );
}

export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  const c = useChartColors();
  const items = STATUS_ORDER.map((s) => ({
    label: s.label,
    color: c.status[s.id],
    value: data.find((d) => d.status === s.id)?.count ?? 0,
  }));
  return <LabeledDonut items={items} />;
}

export function ReportingDonut({
  data,
}: {
  data: { identified: number; anonymous: number; sos: number };
}) {
  const c = useChartColors();
  return (
    <LabeledDonut
      items={[
        { label: "Identified", value: data.identified, color: c.accent },
        { label: "Anonymous", value: data.anonymous, color: c.violet },
        { label: "SOS", value: data.sos, color: c.sos },
      ]}
    />
  );
}
