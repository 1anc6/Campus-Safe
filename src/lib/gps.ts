import { CAMPUS } from "./campus";
import type { GpsFix } from "./types";
import type { GpsState } from "@/components/shared/gps-strip";

const LAST_FIX_KEY = "aegis.last_fix";
const PENDING_KEY = "aegis.sos_pending";

export function readLastFix(): GpsFix | null {
  try {
    const raw = localStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GpsFix;
  } catch {
    return null;
  }
}

export function writeLastFix(fix: GpsFix) {
  try {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix));
  } catch {
    /* ignore */
  }
}

export function readPendingSos(): (GpsFix & { ts: number }) | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GpsFix & { ts: number };
  } catch {
    return null;
  }
}

export function writePendingSos(body: GpsFix & { ts: number }) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(body));
  } catch {
    /* ignore */
  }
}

export function clearPendingSos() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Browsers only expose GPS on secure origins (HTTPS or localhost). On a plain
 * `http://` LAN address the API exists but always fails, so callers can explain
 * why instead of silently falling back to an approximate location.
 */
export function gpsBlockedByInsecureOrigin(): boolean {
  return typeof window !== "undefined" && !window.isSecureContext;
}

export function getFix(): Promise<GpsFix> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      const last = readLastFix();
      resolve(
        last
          ? { ...last, approx: true }
          : { lat: CAMPUS.center.lat, lng: CAMPUS.center.lng, acc: 80, approx: true },
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const fix: GpsFix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          approx: false,
        };
        writeLastFix(fix);
        resolve(fix);
      },
      () => {
        const last = readLastFix();
        resolve(
          last
            ? { ...last, approx: true }
            : { lat: CAMPUS.center.lat, lng: CAMPUS.center.lng, acc: 80, approx: true },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );
  });
}

export function gpsStateFromFix(
  fix: GpsFix | null,
  locating: boolean,
  permission: PermissionState | "unknown",
): GpsState {
  if (gpsBlockedByInsecureOrigin()) return "insecure";
  if (locating) return "locating";
  if (permission === "denied") return "off";
  if (!fix) return "off";
  if (fix.approx) return "approximate";
  return "ready";
}
