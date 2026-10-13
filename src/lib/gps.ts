import { CAMPUS } from "./campus";
import type { GpsFix } from "./types";
import type { GpsState } from "@/components/shared/gps-strip";

const LAST_FIX_KEY = "aegis.last_fix";
const PENDING_KEY = "aegis.sos_pending";

/** A stored fix older than this is not used as the student's current position. */
const LAST_FIX_MAX_AGE_MS = 10 * 60_000;

/**
 * Fallback when there is no fix at all: the campus centre, with an uncertainty
 * radius covering the whole campus so command never reads it as a precise pin.
 */
const CAMPUS_GUESS_ACC_M = 300;

/** The last real fix from this device (with when it was taken), if any. */
export function readLastFix(): (GpsFix & { ts?: number }) | null {
  try {
    const raw = localStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GpsFix & { ts?: number };
  } catch {
    return null;
  }
}

/** The last real fix only when it is recent enough to stand in for "here". */
function recentLastFix(): GpsFix | null {
  const last = readLastFix();
  if (!last?.ts || Date.now() - last.ts > LAST_FIX_MAX_AGE_MS) return null;
  return { lat: last.lat, lng: last.lng, acc: last.acc, approx: true };
}

export function writeLastFix(fix: GpsFix) {
  try {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ ...fix, ts: Date.now() }));
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

function fallbackFix(): GpsFix {
  return (
    recentLastFix() ?? {
      lat: CAMPUS.center.lat,
      lng: CAMPUS.center.lng,
      acc: CAMPUS_GUESS_ACC_M,
      approx: true,
    }
  );
}

/** Accuracy (metres) at which a fix is good enough to stop waiting for a better one. */
export const GOOD_FIX_M = 30;

function toFix(p: GeolocationPosition): GpsFix {
  return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, approx: false };
}

/** Whether `next` is a better position than `current` (smaller accuracy radius). */
export function isBetterFix(next: GpsFix, current: GpsFix | null): boolean {
  if (!current) return true;
  if (current.approx) return !next.approx;
  if (next.approx) return false;
  return (next.acc ?? Infinity) < (current.acc ?? Infinity);
}

/**
 * Collects positions in the background and keeps the most accurate one. Phones
 * often answer first with a coarse Wi-Fi/cell estimate (hundreds of metres off)
 * and only then lock real GPS, so the first reading must not be trusted blindly.
 */
export function startFixCollector(seed?: GpsFix | null) {
  let best: GpsFix | null = seed && !seed.approx ? seed : null;
  let watchId: number | null = null;
  const waiters = new Set<() => void>();
  const notify = () => waiters.forEach((w) => w());

  if (
    typeof navigator !== "undefined" &&
    "geolocation" in navigator &&
    !gpsBlockedByInsecureOrigin()
  ) {
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        const fix = toFix(p);
        if (isBetterFix(fix, best)) {
          best = fix;
          writeLastFix(fix);
          notify();
        }
      },
      () => notify(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  return {
    best: () => best,
    /** Resolve with the best fix once it is good enough, or after `maxWaitMs`. */
    wait(maxWaitMs: number): Promise<GpsFix> {
      return new Promise((resolve) => {
        const done = () => {
          window.clearTimeout(timer);
          waiters.delete(check);
          resolve(best ?? fallbackFix());
        };
        const check = () => {
          if (best && (best.acc ?? Infinity) <= GOOD_FIX_M) done();
        };
        const timer = window.setTimeout(done, maxWaitMs);
        waiters.add(check);
        check();
      });
    },
    stop() {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      waiters.clear();
    },
  };
}

/**
 * One position for a report or alert: waits up to `maxWaitMs` for an accurate
 * GPS fix, keeping the best reading. Falls back to a recent stored fix, then to
 * the campus-wide guess (both flagged approximate).
 */
export async function getFix(maxWaitMs = 8000): Promise<GpsFix> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return fallbackFix();
  const collector = startFixCollector();
  try {
    return await collector.wait(maxWaitMs);
  } finally {
    collector.stop();
  }
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
