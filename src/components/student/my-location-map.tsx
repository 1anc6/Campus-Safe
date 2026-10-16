import { LocateFixed, MapPin, MapPinOff, Navigation } from "lucide-react";
import { useState } from "react";
import { LiveMap, type MapMarker } from "@/components/shared/live-map";
import type { LiveLocation } from "@/lib/use-live-location";
import { cn } from "@/lib/utils";
import { formatKm } from "@/lib/campus";

const STATUS_COPY: Record<Exclude<LiveLocation["status"], "live">, string> = {
  locating: "Finding your location…",
  insecure: "Live GPS needs a secure (https) link",
  denied: "Location permission is off",
  unsupported: "This browser can't share location",
  unavailable: "GPS signal unavailable",
};

const HELP_COPY: Partial<Record<LiveLocation["status"], string>> = {
  insecure: "Open CampusSafe over https so command can see exactly where you are during an SOS.",
  denied: "Allow location for this site in your browser settings so responders can find you.",
  unavailable: "Move near a window or outdoors for a better signal.",
};

/**
 * Ride-hailing style "you are here" map: follows the student, pauses following
 * when they pan, and offers a one-tap re-centre.
 */
export function MyLocationMap({
  location,
  className,
}: {
  location: LiveLocation;
  className?: string;
}) {
  const [follow, setFollow] = useState(true);
  const [recenter, setRecenter] = useState(0);
  const { fix, status, near, onCampus, proximity } = location;
  const live = status === "live" && fix && !fix.approx;
  const tooFar = live && proximity?.zone === "far";

  const markers: MapMarker[] = fix
    ? [
        {
          id: "me",
          lat: fix.lat,
          lng: fix.lng,
          kind: "self",
          label: "You",
          accuracyM: live ? fix.acc : null,
          approx: !live,
        },
      ]
    : [];
  const focus = follow && fix ? { lat: fix.lat, lng: fix.lng } : null;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <LiveMap
        markers={markers}
        focus={focus}
        recenter={recenter}
        onUserPan={() => setFollow(false)}
        className="absolute inset-0 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between gap-2">
        <div
          className={cn(
            "pointer-events-auto flex max-w-[78%] items-center gap-2 rounded-full bg-chrome/90 py-2 pl-2.5 pr-3.5 text-xs font-medium shadow-lg ring-1 backdrop-blur",
            tooFar ? "ring-sos/40" : live ? "ring-neon/30" : "ring-warn/30",
          )}
          role="status"
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full",
              tooFar
                ? "bg-sos/15 text-sos"
                : live
                  ? "bg-neon-dim text-neon"
                  : "bg-warn/15 text-warn",
            )}
          >
            {live ? <MapPin className="size-3.5" /> : <MapPinOff className="size-3.5" />}
          </span>
          <span className="min-w-0 truncate">
            {live ? (
              <>
                {near
                  ? `Near ${near.name}`
                  : onCampus
                    ? "On campus"
                    : proximity?.zone === "far"
                      ? "Area too far from campus"
                      : "Just outside campus"}
                {proximity && !onCampus ? (
                  <span className="text-muted"> · {formatKm(proximity.distance)} away</span>
                ) : (
                  fix?.acc != null && (
                    <span className="text-muted"> · ±{Math.round(fix.acc)} m</span>
                  )
                )}
              </>
            ) : (
              STATUS_COPY[status as Exclude<LiveLocation["status"], "live">]
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (fix) setFollow(true);
            else setRecenter((n) => n + 1);
          }}
          className={cn(
            "pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full neu-raised transition-colors hover:text-neon",
            fix && !follow ? "text-neon" : "text-muted",
          )}
          aria-label={fix ? "Re-centre on my location" : "Show campus"}
        >
          {fix && !follow ? <Navigation className="size-4" /> : <LocateFixed className="size-4" />}
        </button>
      </div>

      {tooFar && (
        <p className="absolute bottom-3 left-3 right-14 z-[500] rounded-xl bg-chrome/90 px-3 py-2 text-xs ring-1 ring-sos/30 backdrop-blur">
          <span className="font-semibold text-sos">
            You&apos;re outside the campus response area.
          </span>{" "}
          <span className="text-muted">
            Campus security can&apos;t reach you quickly here — for emergencies call 112.
          </span>
        </p>
      )}

      {!live && HELP_COPY[status] && (
        <p className="absolute bottom-3 left-3 right-14 z-[500] rounded-xl bg-chrome/90 px-3 py-2 text-xs text-muted ring-1 ring-warn/25 backdrop-blur">
          {HELP_COPY[status]}
        </p>
      )}
    </div>
  );
}
