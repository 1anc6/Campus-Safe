/**
 * Walking routes over real paths — OpenStreetMap footways routed by OSRM's foot
 * profile — plus turn-by-turn steps and "where am I on the route" maths. Pure
 * functions (fetch aside) so they are unit-tested in `walk-route.test.ts`.
 */
import { distanceM, LOCATIONS } from "./campus.ts";

export type LatLng = { lat: number; lng: number };

export type TurnKind =
  | "depart"
  | "straight"
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "sharp-left"
  | "sharp-right"
  | "uturn"
  | "arrive";

export type RouteStep = {
  /** "Turn left onto Bell Road", "At the end of the path, turn right near Mess". */
  text: string;
  kind: TurnKind;
  /** Where the manoeuvre happens. */
  at: LatLng;
  /** Length of the stretch that follows this manoeuvre. */
  distanceM: number;
  /** Distance from the route start to this manoeuvre. */
  startM: number;
};

export type WalkRoute = {
  /** The path to walk, start to destination. */
  points: LatLng[];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  /** Main named way on the route, for "via Bell Road". */
  via: string | null;
};

/**
 * FOSSGIS's public OSRM server (the one openstreetmap.org's own directions use),
 * foot profile. Point VITE_ROUTING_URL at a self-hosted OSRM for production load.
 */
const ROUTING_URL =
  (import.meta.env?.VITE_ROUTING_URL as string | undefined) ??
  "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

type OsrmStep = {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    bearing_after?: number;
    exit?: number;
  };
};
type OsrmResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: OsrmStep[] }[];
  }[];
};

/** Shortest walkable route from `from` to `to`, or throws when none is found. */
export async function fetchWalkRoute(
  from: LatLng,
  to: LatLng & { name?: string },
  signal?: AbortSignal,
): Promise<WalkRoute> {
  const coords = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  const res = await fetch(`${ROUTING_URL}/${coords}?overview=full&geometries=geojson&steps=true`, {
    signal,
  });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  return parseOsrm((await res.json()) as OsrmResponse, to.name);
}

export function parseOsrm(data: OsrmResponse, destName?: string): WalkRoute {
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error("No walking route found");
  const points = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const raw = r.legs.flatMap((l) => l.steps);

  const steps: RouteStep[] = [];
  let startM = 0;
  const byName = new Map<string, number>();
  for (const s of raw) {
    if (s.name) byName.set(s.name, (byName.get(s.name) ?? 0) + s.distance);
    const kind = turnKind(s.maneuver.type, s.maneuver.modifier);
    const prev = steps[steps.length - 1];
    // "Continue" on the same line is not an instruction: fold it into the stretch before.
    const silent =
      prev &&
      kind === "straight" &&
      (s.maneuver.type === "new name" || s.maneuver.type === "continue") &&
      (!s.name || s.name === lastName(raw, s));
    if (silent) {
      prev.distanceM += s.distance;
    } else {
      steps.push({
        text: stepText(s, kind, destName),
        kind,
        at: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
        distanceM: s.distance,
        startM,
      });
    }
    startM += s.distance;
  }

  let via: string | null = null;
  let best = 0;
  for (const [name, d] of byName) {
    if (d > best) [via, best] = [name, d];
  }
  return { points, distanceM: r.distance, durationS: r.duration, steps, via };
}

function lastName(all: OsrmStep[], s: OsrmStep): string {
  const i = all.indexOf(s);
  return i > 0 ? all[i - 1]!.name : "";
}

function turnKind(type: string, modifier?: string): TurnKind {
  if (type === "depart") return "depart";
  if (type === "arrive") return "arrive";
  switch (modifier) {
    case "left":
      return "left";
    case "right":
      return "right";
    case "slight left":
      return "slight-left";
    case "slight right":
      return "slight-right";
    case "sharp left":
      return "sharp-left";
    case "sharp right":
      return "sharp-right";
    case "uturn":
      return "uturn";
    default:
      return "straight";
  }
}

const TURN_VERB: Record<TurnKind, string> = {
  depart: "Head",
  straight: "Continue straight",
  left: "Turn left",
  right: "Turn right",
  "slight-left": "Bear left",
  "slight-right": "Bear right",
  "sharp-left": "Turn sharp left",
  "sharp-right": "Turn sharp right",
  uturn: "Turn around",
  arrive: "Arrive",
};

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

/** Campus paths are mostly unnamed in OSM, so anchor turns to the nearest named place. */
function landmark(at: LatLng): string | null {
  let best: { name: string; d: number } | null = null;
  for (const l of LOCATIONS) {
    const d = distanceM(at, l);
    if (!best || d < best.d) best = { name: l.name, d };
  }
  return best && best.d <= 45 ? best.name : null;
}

function stepText(s: OsrmStep, kind: TurnKind, destName?: string): string {
  const at = { lat: s.maneuver.location[1], lng: s.maneuver.location[0] };
  if (kind === "arrive") return destName ? `Arrive at ${destName}` : "Arrive at your destination";
  const where = s.name ? ` onto ${s.name}` : landmark(at) ? ` near ${landmark(at)}` : "";
  if (kind === "depart") {
    const dir = COMPASS[Math.round((s.maneuver.bearing_after ?? 0) / 45) % 8];
    return `Head ${dir}${s.name ? ` on ${s.name}` : ""}`;
  }
  const verb = TURN_VERB[kind];
  switch (s.maneuver.type) {
    case "end of road":
      return `At the end of the path, ${verb.toLowerCase()}${where}`;
    case "fork":
      return `Keep ${kind.includes("left") ? "left" : kind.includes("right") ? "right" : "straight"} at the fork${where}`;
    case "roundabout":
    case "rotary":
      return `At the roundabout, take exit ${s.maneuver.exit ?? 1}${where}`;
    default:
      return `${verb}${where}`;
  }
}

/** Metres between two nearby points on a flat local projection (fine at campus scale). */
function project(origin: LatLng, p: LatLng): { x: number; y: number } {
  const k = 111_320;
  return {
    x: (p.lng - origin.lng) * k * Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * k,
  };
}

export type RouteProgress = {
  /** How far you are from the route line. */
  offRouteM: number;
  /** Distance already covered along the route. */
  doneM: number;
  /** Distance left along the route to the destination. */
  remainingM: number;
  /** The route ahead of you, starting at your projected position. */
  ahead: LatLng[];
  /** Next manoeuvre ahead and how far away it is. */
  next: { step: RouteStep; inM: number } | null;
};

/** Snap a position onto the route: how far along, how far off, and what's next. */
export function routeProgress(route: WalkRoute, pos: LatLng): RouteProgress {
  const pts = route.points;
  if (pts.length < 2) {
    const d = distanceM(pos, pts[0] ?? pos);
    return { offRouteM: d, doneM: 0, remainingM: d, ahead: [pos, ...pts], next: null };
  }
  let bestD = Infinity;
  let bestI = 0;
  let bestT = 0;
  let bestPt = pts[0]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const B = project(a, b);
    const P = project(a, pos);
    const len2 = B.x * B.x + B.y * B.y;
    const t = len2 ? Math.min(1, Math.max(0, (P.x * B.x + P.y * B.y) / len2)) : 0;
    const dx = P.x - t * B.x;
    const dy = P.y - t * B.y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      bestI = i;
      bestT = t;
      bestPt = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
    }
  }
  let geomTotal = 0;
  let done = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = distanceM(pts[i]!, pts[i + 1]!);
    if (i < bestI) done += seg;
    else if (i === bestI) done += seg * bestT;
    geomTotal += seg;
  }
  // Step offsets come from the router; rescale them onto this geometry's length.
  const scale = route.distanceM > 0 ? geomTotal / route.distanceM : 1;
  const nextStep = route.steps.find((s) => s.kind !== "depart" && s.startM * scale > done + 3);
  return {
    offRouteM: bestD,
    doneM: done,
    remainingM: Math.max(0, geomTotal - done),
    ahead: [bestPt, ...pts.slice(bestI + 1)],
    next: nextStep ? { step: nextStep, inM: Math.max(0, nextStep.startM * scale - done) } : null,
  };
}

/** Walking pace of a route in m/s, falling back to an unhurried 1.3 m/s. */
export function routePace(route: WalkRoute | null): number {
  return route && route.durationS > 0 ? route.distanceM / route.durationS : 1.3;
}

/**
 * The check-in time to suggest for a walk: the walk itself plus a buffer for
 * stops (half the walk, at least 5 min), rounded up to the next 5 minutes.
 */
export function suggestedCheckInMinutes(walkMinutes: number): number {
  const buffer = Math.max(5, Math.ceil(walkMinutes * 0.5));
  return Math.min(120, Math.max(5, Math.ceil((walkMinutes + buffer) / 5) * 5));
}
