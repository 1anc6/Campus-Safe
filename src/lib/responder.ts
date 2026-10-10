import { useEffect, useState } from "react";

/** Walking directions to a point in Google Maps (opens the app on phones). */
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

/** Re-render on an interval so elapsed timers stay current between data refreshes. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(i);
  }, [intervalMs]);
  return now;
}

/** "320 m" / "1.4 km". */
export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}
