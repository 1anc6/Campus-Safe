import { cn } from "@/lib/utils";
import { MapPin, MapPinOff } from "lucide-react";

export type GpsState = "ready" | "off" | "locating" | "approximate" | "retrying" | "insecure";

export function GpsStrip({
  state,
  accuracy,
  onEnable,
}: {
  state: GpsState;
  accuracy?: number | null;
  onEnable?: () => void;
}) {
  const copy: Record<GpsState, string> = {
    ready: accuracy ? `GPS: ready · ±${Math.round(accuracy)}m` : "GPS: ready",
    off: "GPS: off — tap to enable",
    locating: "GPS: locating…",
    approximate: "GPS: approximate fix",
    retrying: "Not sent yet — retrying",
    insecure: "GPS blocked — open the app over HTTPS",
  };
  const tone: Record<GpsState, string> = {
    ready: "text-ok",
    off: "text-sos",
    locating: "text-warn",
    approximate: "text-warn",
    retrying: "text-sos",
    insecure: "text-warn",
  };
  return (
    <button
      type="button"
      onClick={state === "off" ? onEnable : undefined}
      className="flex items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-line"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "ready" && "bg-ok",
          state === "off" && "bg-sos",
          (state === "locating" || state === "approximate" || state === "insecure") && "bg-warn",
          state === "retrying" && "bg-sos animate-pulse",
        )}
      />
      {state === "off" || state === "insecure" ? (
        <MapPinOff className={cn("size-3.5", tone[state])} />
      ) : (
        <MapPin className={cn("size-3.5", tone[state])} />
      )}
      <span className={tone[state]}>{copy[state]}</span>
    </button>
  );
}
