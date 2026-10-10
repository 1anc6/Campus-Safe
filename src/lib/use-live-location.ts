import { useEffect, useState } from "react";
import { campusProximity, nearestLocation, type CampusProximity } from "./campus";
import { gpsBlockedByInsecureOrigin, readLastFix, writeLastFix } from "./gps";
import type { GpsFix } from "./types";

export type LiveLocationStatus =
  "locating" | "live" | "denied" | "insecure" | "unsupported" | "unavailable";

export type LiveLocation = {
  /** Latest real fix (or the last stored one while waiting). */
  fix: GpsFix | null;
  status: LiveLocationStatus;
  /** Nearest named campus place when the fix is on or near campus. */
  near: { name: string; distance: number } | null;
  onCampus: boolean;
  /** Distance zone from campus (on / near / far), when there is a fix. */
  proximity: CampusProximity | null;
};

/**
 * Continuously track the device position while mounted (navigator.geolocation
 * watchPosition), like a ride-hailing "you are here" dot. Read-only: nothing is
 * sent to the server until the student raises an SOS.
 */
export function useLiveLocation(): LiveLocation {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [status, setStatus] = useState<LiveLocationStatus>("locating");

  useEffect(() => {
    const last = readLastFix();
    if (last) setFix({ ...last, approx: true });
    if (gpsBlockedByInsecureOrigin()) {
      setStatus("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next: GpsFix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          approx: false,
        };
        writeLastFix(next);
        setFix(next);
        setStatus("live");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const proximity = fix ? campusProximity(fix) : null;
  const onCampus = proximity?.zone === "on";
  return { fix, status, near: fix && onCampus ? nearestLocation(fix) : null, onCampus, proximity };
}
