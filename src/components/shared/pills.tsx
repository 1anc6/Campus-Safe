import { cn } from "@/lib/utils";
import type { IncidentStatus, Severity, SosStatus } from "@/lib/campus";

export function SeverityChip({ value }: { value: Severity }) {
  const map: Record<Severity, string> = {
    P1: "bg-sos/15 text-sos",
    P2: "bg-high/15 text-high",
    P3: "bg-warn/15 text-warn",
    P4: "bg-ok/15 text-ok",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        map[value],
      )}
    >
      {value}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    reported: "bg-neon/15 text-neon",
    under_review: "bg-violet/15 text-violet",
    in_progress: "bg-warn/15 text-warn",
    resolved: "bg-ok/15 text-ok",
    closed: "bg-muted/20 text-muted",
    sent: "bg-neon/15 text-neon",
    received: "bg-violet/15 text-violet",
    assigned: "bg-warn/15 text-warn",
    arrived: "bg-ok/15 text-ok",
    cancelled: "bg-muted/20 text-muted",
  };
  const label = status.replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        map[status] ?? "bg-muted/20 text-muted",
      )}
    >
      {label}
    </span>
  );
}

export function KindChip({ kind }: { kind: "sos" | "incident" | "anonymous" }) {
  const map = {
    sos: "bg-sos/15 text-sos",
    incident: "bg-neon/15 text-neon",
    anonymous: "bg-violet/15 text-violet",
  };
  const label = { sos: "SOS", incident: "INC", anonymous: "ANON" };
  return (
    <span
      className={cn(
        "inline-flex w-11 shrink-0 items-center justify-center rounded-full py-0.5 text-[10px] font-bold tracking-wider",
        map[kind],
      )}
    >
      {label[kind]}
    </span>
  );
}

export function Delta({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        up ? "bg-ok/15 text-ok" : "bg-sos/15 text-sos",
      )}
    >
      {children}
    </span>
  );
}

export type { IncidentStatus, SosStatus };
