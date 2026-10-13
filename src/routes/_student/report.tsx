import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Camera,
  CarFront,
  CircleDot,
  Construction,
  Eye,
  Flame,
  HeartPulse,
  ImageOff,
  ListChecks,
  LoaderCircle,
  MapPin,
  Send,
  ShieldAlert,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/student/student-shell";
import { FormSection, SummaryRow } from "@/components/student/form-section";
import { MyLocationMap } from "@/components/student/my-location-map";
import { CATEGORIES, LOCATIONS, SEVERITIES, type Severity } from "@/lib/campus";
import { getFix } from "@/lib/gps";
import { createIncident } from "@/backend/functions/reports";
import type { GpsFix } from "@/lib/types";
import { useLiveLocation } from "@/lib/use-live-location";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student/report")({
  staticData: { width: "wide" },
  component: ReportForm,
});

const ICONS = {
  "shield-alert": ShieldAlert,
  briefcase: Briefcase,
  "heart-pulse": HeartPulse,
  flame: Flame,
  construction: Construction,
  "user-x": UserX,
  eye: Eye,
  "car-front": CarFront,
  "circle-dot": CircleDot,
} as const;

const SEVERITY_TONE: Record<Severity, string> = {
  P1: "text-sos",
  P2: "text-high",
  P3: "text-warn",
  P4: "text-ok",
};

function ReportForm() {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string>(LOCATIONS[0].id);
  const [useGps, setUseGps] = useState(false);
  const [gpsFix, setGpsFix] = useState<GpsFix | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("P3");
  const [occurredAt, setOccurredAt] = useState(() => localNow());
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(file: File | null) {
    setPhoto(file ? await compressImage(file) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Pick a category.");
      return;
    }
    if (description.trim().length < 8) {
      setError("Describe what happened (at least a sentence).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (useGps) {
        const fix = gpsFix && !gpsFix.approx ? gpsFix : await getFix();
        lat = fix.lat;
        lng = fix.lng;
      }
      const res = await createIncident({
        data: {
          categoryId,
          locationId: useGps ? null : locationId,
          lat,
          lng,
          description: description.trim(),
          severity,
          occurredAt: new Date(occurredAt).toISOString(),
          photoData: photo,
        },
      });
      await navigate({ to: "/reports/$id", params: { id: res.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file the report");
    } finally {
      setBusy(false);
    }
  }

  const category = CATEGORIES.find((c) => c.id === categoryId);
  const place = useGps ? "Your GPS position" : LOCATIONS.find((l) => l.id === locationId)?.name;
  const sev = SEVERITIES.find((s) => s.id === severity)!;

  return (
    <>
      <PageHeading
        title="Report an incident"
        subtitle="Campus command reviews every report. Track status changes and replies under My reports."
      />
      <form
        onSubmit={submit}
        noValidate
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      >
        <div className="min-w-0 space-y-4">
          <FormSection step={1} title="What happened?" hint="Pick the closest category.">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {CATEGORIES.map((c) => {
                const Icon = ICONS[c.icon as keyof typeof ICONS] ?? CircleDot;
                const on = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center text-xs font-semibold ring-1 transition-colors",
                      on
                        ? "bg-neon-dim text-neon ring-neon/60"
                        : "bg-panel-2/50 text-fg ring-line hover:bg-panel-2",
                    )}
                  >
                    <Icon className="size-5" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Where and when?"
            hint="Choose a campus place, or drop a pin at your current position."
          >
            <div
              className="seg mb-3 w-full [&>button]:flex-1"
              role="group"
              aria-label="Location type"
            >
              <button type="button" aria-pressed={!useGps} onClick={() => setUseGps(false)}>
                Campus place
              </button>
              <button type="button" aria-pressed={useGps} onClick={() => setUseGps(true)}>
                Use my GPS
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {useGps ? (
                <GpsPin onFix={setGpsFix} />
              ) : (
                <label className="block">
                  <span className="field-label">Place</span>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="input"
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} · {l.zone}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="field-label">When</span>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="input"
                />
              </label>
            </div>
          </FormSection>

          <FormSection step={3} title="How serious is it?">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {SEVERITIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  aria-pressed={severity === s.id}
                  className={cn(
                    "rounded-xl p-3 text-left ring-1 transition-colors",
                    severity === s.id
                      ? "bg-panel-2 ring-neon/50"
                      : "bg-panel-2/40 ring-line hover:bg-panel-2",
                  )}
                >
                  <span className={cn("font-display text-sm font-bold", SEVERITY_TONE[s.id])}>
                    {s.id} · {s.label}
                  </span>
                  <p className="mt-1 text-[11px] text-muted">{s.hint}</p>
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection
            step={4}
            title="Details"
            hint="Facts only: where, who, what you need. A photo helps."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g. Bicycle taken from the rack outside the library, lock was cut."
              className="input min-h-32"
              aria-label="What happened"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="btn-ghost cursor-pointer">
                <Camera className="size-4" />
                {photo ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
              {photo && (
                <div className="flex items-center gap-2">
                  <img
                    src={photo}
                    alt="Attached"
                    className="size-14 rounded-lg object-cover ring-1 ring-line"
                  />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="btn-ghost min-h-10 px-3 text-xs"
                  >
                    <ImageOff className="size-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-8">
          <div className="card p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-neon" /> Your report
            </h2>
            <div className="divide-y divide-line">
              <SummaryRow
                label="Category"
                value={category?.name ?? "Not chosen"}
                muted={!category}
              />
              <SummaryRow label="Location" value={place ?? "—"} />
              <SummaryRow
                label="Severity"
                value={
                  <span className={SEVERITY_TONE[severity]}>
                    {severity} · {sev.label}
                  </span>
                }
              />
              <SummaryRow label="Photo" value={photo ? "Attached" : "None"} muted={!photo} />
            </div>
            {error && (
              <p
                className="mt-3 rounded-lg bg-sos/10 p-2.5 text-sm text-sos ring-1 ring-sos/30"
                role="alert"
              >
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-neon mt-4 min-h-12 w-full">
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {busy ? "Filing…" : "Submit report"}
            </button>
          </div>
          <p className="px-1 text-xs text-dim">
            In danger right now? Use the SOS button on Home instead — it alerts command instantly
            with your location.
          </p>
        </aside>
      </form>
    </>
  );
}

/** Live "drop a pin here" preview; only mounted when GPS is chosen, so it never prompts otherwise. */
function GpsPin({ onFix }: { onFix: (fix: GpsFix | null) => void }) {
  const location = useLiveLocation();
  const fix = location.status === "live" ? location.fix : null;
  // Hand the latest fix to the form for submission.
  useEffect(() => onFix(fix), [fix, onFix]);
  return (
    <div className="sm:col-span-2">
      <MyLocationMap location={location} className="h-56 rounded-xl ring-1 ring-line" />
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="size-3.5 text-neon" />
        {fix
          ? "The pin is placed where you are now."
          : "If GPS isn't available, an approximate position is used."}
      </p>
    </div>
  );
}

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.62);
}
