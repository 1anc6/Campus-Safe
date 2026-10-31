import { useEffect, useMemo, useRef, useState } from "react";
import { distanceM } from "@/lib/campus";
import type { LiveLocation } from "@/lib/use-live-location";
import {
  fetchWalkRoute,
  routeProgress,
  type RouteProgress,
  type WalkRoute,
} from "@/lib/walk-route";

/** Further than this from the route line counts as off route, and we re-route. */
export const OFF_ROUTE_M = 45;
/** Never ask the router more often than this while re-routing. */
const REROUTE_MIN_MS = 15_000;

export type WalkRouteState = {
  route: WalkRoute | null;
  /** Where you are on the route right now (needs a live fix). */
  progress: RouteProgress | null;
  status: "idle" | "loading" | "ready" | "error";
  /** You've strayed from the route; a fresh one is on its way. */
  offRoute: boolean;
};

/**
 * The shortest walkable route from the live GPS fix to `to`. Fetched once per
 * destination and again only when you wander off it, so GPS updates move you
 * along the route without hammering the router.
 */
export function useWalkRoute(
  location: LiveLocation,
  to: { name: string; lat: number; lng: number } | null,
): WalkRouteState {
  const fix =
    location.status === "live" && location.fix && !location.fix.approx ? location.fix : null;
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [status, setStatus] = useState<WalkRouteState["status"]>("idle");
  const [attempt, setAttempt] = useState(0);
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const lastFetch = useRef(0);
  const fetchedFrom = useRef<{ lat: number; lng: number } | null>(null);
  const destKey = to ? `${to.name}|${to.lat},${to.lng}` : null;
  const hasFix = Boolean(fix);

  useEffect(() => {
    setRoute(null);
    setStatus("idle");
  }, [destKey]);

  useEffect(() => {
    const from = fixRef.current;
    if (!to || !from) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 10_000);
    lastFetch.current = Date.now();
    fetchedFrom.current = from;
    setStatus("loading");
    fetchWalkRoute(from, to, ctrl.signal)
      .then((r) => {
        setRoute(r);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      ctrl.abort();
    };
    // Re-run per destination, when GPS first locks, and on re-route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, hasFix, attempt]);

  const progress = useMemo(() => (route && fix ? routeProgress(route, fix) : null), [route, fix]);

  // Wandered off the line (or the first try failed): fetch a fresh route from here.
  // Starting far from any mapped path is not "off route" until you actually move.
  const offRoute =
    progress != null &&
    fix != null &&
    progress.offRouteM > OFF_ROUTE_M + (fix.acc ?? 0) / 2 &&
    (!fetchedFrom.current || distanceM(fix, fetchedFrom.current) > OFF_ROUTE_M);
  const retry = offRoute || (status === "error" && hasFix);
  useEffect(() => {
    if (!retry) return;
    const wait = Math.max(0, lastFetch.current + REROUTE_MIN_MS - Date.now());
    const t = window.setTimeout(() => setAttempt((n) => n + 1), wait);
    return () => window.clearTimeout(t);
  }, [retry, attempt]);

  return { route, progress, status, offRoute };
}
