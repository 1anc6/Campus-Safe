import { useEffect, useRef } from "react";
import { CAMPUS } from "@/lib/campus";
import type { Severity } from "@/lib/campus";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "sos" | "incident" | "anonymous" | "self" | "unit" | "resolved";
  label?: string;
  severity?: Severity;
  /** GPS accuracy radius in metres; drawn as a translucent circle. */
  accuracyM?: number | null;
  /** No real GPS fix (e.g. blocked on http): drawn hollow with a dashed radius. */
  approx?: boolean;
};

type LatLng = { lat: number; lng: number };

const TRAIL_COLOR: Record<string, string> = { sos: "#FF3B4E", default: "#35E0FF" };

export function LiveMap({
  markers,
  trail,
  trails,
  focus,
  recenter,
  onUserPan,
  className,
}: {
  markers: MapMarker[];
  /** A single path (e.g. one SOS alert's movement). */
  trail?: LatLng[];
  /** Several paths at once (live SOS board). */
  trails?: { id: string; points: LatLng[]; highlight?: boolean }[];
  focus?: LatLng | null;
  /** Change this number to fly back to the whole campus. */
  recenter?: number;
  /** Called when the person drags the map (e.g. to pause "follow me"). */
  onUserPan?: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const lastFocus = useRef<string | null>(null);
  const resizeObs = useRef<ResizeObserver | null>(null);
  // Latest props for draw(): the map initialises asynchronously, so the first draw
  // must use current data, not the (possibly empty) props from the first render.
  const latest = useRef({ markers, trail, trails, focus, onUserPan });
  latest.current = { markers, trail, trails, focus, onUserPan };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current || mapRef.current) return;
      // Half-step zoom lets the campus fill the frame instead of snapping a level out.
      const map = L.map(host.current, {
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 0.5,
      });
      // Open on the whole campus (or the focused point when there is one).
      const start = latest.current.focus;
      if (start) map.setView([start.lat, start.lng], 18);
      else map.fitBounds(CAMPUS.bounds, { padding: [16, 16] });
      lastFocus.current = start ? `${start.lat},${start.lng}` : null;
      // Keyless OpenStreetMap tiles, darkened in CSS (`.leaflet-tile-pane`) to fit the theme.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("dragstart", () => latest.current.onUserPan?.());
      // Re-measure when the container changes size (responsive grids, rotation,
      // panels appearing) — Leaflet otherwise keeps stale grey tiles.
      resizeObs.current = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resizeObs.current.observe(host.current);
      mapRef.current = map;
      draw(L);
    })();
    return () => {
      cancelled = true;
      resizeObs.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    void import("leaflet").then(draw);
  }, [markers, trail, trails, focus]);

  useEffect(() => {
    if (!recenter || !mapRef.current) return;
    lastFocus.current = null;
    mapRef.current.flyToBounds(CAMPUS.bounds, { padding: [16, 16], duration: 0.6 });
  }, [recenter]);

  function draw(L: typeof import("leaflet")) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const { markers, trail, trails, focus } = latest.current;
    layer.clearLayers();

    const paths = [
      ...(trail && trail.length > 1 ? [{ id: "trail", points: trail, highlight: false }] : []),
      ...(trails ?? []).filter((t) => t.points.length > 1),
    ];
    for (const p of paths) {
      L.polyline(
        p.points.map((pt) => [pt.lat, pt.lng] as [number, number]),
        {
          color: p.highlight ? TRAIL_COLOR.sos : TRAIL_COLOR.default,
          weight: p.highlight ? 4 : 3,
          opacity: p.highlight ? 0.95 : 0.7,
          dashArray: p.highlight ? undefined : "4 6",
        },
      ).addTo(layer);
    }

    for (const m of markers) {
      if (m.accuracyM && m.accuracyM > 0 && m.accuracyM < 2000) {
        L.circle([m.lat, m.lng], {
          radius: m.accuracyM,
          color: m.kind === "sos" ? "#FF3B4E" : m.kind === "resolved" ? "#2FE6A8" : "#35E0FF",
          weight: 1,
          opacity: 0.6,
          fillOpacity: m.approx ? 0.05 : 0.08,
          dashArray: m.approx ? "4 4" : undefined,
          interactive: false,
        }).addTo(layer);
      }
      const base =
        m.kind === "sos"
          ? "marker-pulse"
          : m.kind === "anonymous"
            ? "marker-pulse violet"
            : m.kind === "resolved"
              ? "marker-dot ok"
              : m.kind === "self"
                ? "marker-self"
                : "marker-pulse neon";
      const cls = m.approx ? `${base} approx` : base;
      // Build pins and tooltips as DOM nodes with textContent: labels can carry
      // user-supplied names and must never be interpreted as HTML.
      const pin = document.createElement("div");
      pin.className = cls;
      pin.setAttribute("aria-label", m.label ?? m.kind);
      const tip = document.createElement("span");
      tip.textContent = m.label ?? m.kind;
      L.marker([m.lat, m.lng], {
        icon: L.divIcon({ className: "", html: pin, iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: m.kind === "sos" || m.kind === "self" ? 1000 : 0,
      })
        .addTo(layer)
        .bindTooltip(tip, { direction: "top", className: "font-sans" });
    }

    // Fly only when the focus target changes, so polling redraws never fight a
    // user who is panning around the map.
    const key = focus ? `${focus.lat},${focus.lng}` : null;
    if (focus && key !== lastFocus.current) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 18), { duration: 0.6 });
    }
    lastFocus.current = key;
  }

  return (
    <div ref={host} className={className ?? "h-full min-h-64 w-full overflow-hidden rounded-lg"} />
  );
}
