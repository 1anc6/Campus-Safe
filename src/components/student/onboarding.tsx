import {
  ArrowLeft,
  ArrowRight,
  Check,
  HeartPulse,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useProfilePanel } from "@/components/student/profile-panel";
import { useViewer } from "@/lib/auth/use-viewer";
import { BRAND } from "@/lib/brand";
import { gpsBlockedByInsecureOrigin, writeLastFix } from "@/lib/gps";
import { cn } from "@/lib/utils";

const storageKey = (userId: string) => `cs-onboarded:${userId}`;

function alreadyOnboarded(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true; // storage blocked: never trap the student in the intro
  }
}

function markOnboarded(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* storage blocked */
  }
}

type LocationState = "idle" | "asking" | "granted" | "denied" | "insecure";

/**
 * First-run welcome for students: how SOS works, turn on location (the browser
 * prompt fires from a tap, which is when browsers allow it), add a medical ID.
 * Shown once per account on this device.
 */
export function StudentOnboarding() {
  const viewer = useViewer();
  const { open: openProfile } = useProfilePanel();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<LocationState>("idle");

  useEffect(() => {
    if (viewer?.role === "student" && !alreadyOnboarded(viewer.userId)) setVisible(true);
  }, [viewer]);

  // Reflect a permission the browser already has.
  useEffect(() => {
    if (!visible) return;
    if (gpsBlockedByInsecureOrigin()) {
      setLocation("insecure");
      return;
    }
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") setLocation("granted");
        else if (p.state === "denied") setLocation("denied");
      })
      .catch(() => {});
  }, [visible]);

  if (!visible || !viewer) return null;

  const finish = (thenOpenMedical = false) => {
    markOnboarded(viewer.userId);
    setVisible(false);
    if (thenOpenMedical) openProfile("medical");
  };

  const askLocation = () => {
    if (!("geolocation" in navigator)) return setLocation("denied");
    setLocation("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        writeLastFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          approx: false,
        });
        setLocation("granted");
      },
      (err) => setLocation(err.code === err.PERMISSION_DENIED ? "denied" : "granted"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const steps = [
    {
      key: "sos",
      art: <SosArt />,
      title: "Hold SOS for 2 seconds",
      body: "The red button is always at the bottom of your screen. Hold it for 2 seconds — you then get 5 seconds to cancel before campus command is alerted with your location.",
    },
    {
      key: "location",
      art: (
        <span className="grid size-24 place-items-center rounded-[28px] bg-accent/15 text-neon">
          <MapPin className="size-11" />
        </span>
      ),
      title: "Turn on location",
      body: "Responders find you by your phone's GPS. Allow location so help can reach you exactly where you are.",
      action: (
        <div className="mt-5 flex flex-col items-center gap-2">
          {location === "granted" ? (
            <p className="flex items-center gap-2 rounded-full bg-ok/15 px-4 py-2 text-sm font-semibold text-ok">
              <Check className="size-4" /> Location is on
            </p>
          ) : location === "insecure" ? (
            <p className="rounded-2xl bg-warn/10 px-4 py-2 text-xs text-warn ring-1 ring-warn/30">
              Location only works on the secure (https) site. Open {BRAND.name} from its https
              address.
            </p>
          ) : location === "denied" ? (
            <p className="rounded-2xl bg-warn/10 px-4 py-2 text-xs text-warn ring-1 ring-warn/30">
              Location is blocked. Tap the icon next to the address bar → Permissions → Location →
              Allow, then reload.
            </p>
          ) : (
            <button
              type="button"
              onClick={askLocation}
              disabled={location === "asking"}
              className="btn-neon"
            >
              {location === "asking" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <MapPin className="size-4" />
              )}
              ALLOW LOCATION
            </button>
          )}
        </div>
      ),
    },
    {
      key: "medical",
      art: (
        <span className="grid size-24 place-items-center rounded-[28px] bg-sos/12 text-sos">
          <HeartPulse className="size-11" />
        </span>
      ),
      title: "Add your medical ID",
      body: "Blood group, an emergency contact and any allergies. Responders see it only during your SOS — it can save precious minutes.",
    },
  ];

  const last = step === steps.length - 1;
  const current = steps[step]!;

  return (
    <div
      className="fixed inset-0 z-[1050] grid place-items-center bg-bg/70 px-4 pb-safe pt-safe backdrop-blur-xl animate-in fade-in-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="glass w-full max-w-sm overflow-hidden p-6 animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ShieldCheck className="size-4 text-neon" /> Welcome to {BRAND.name}
          </p>
          <button
            type="button"
            onClick={() => finish()}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-panel-2 hover:text-fg"
          >
            Skip
          </button>
        </div>

        <div
          key={current.key}
          className="flex flex-col items-center pt-6 text-center animate-in fade-in-0 slide-in-from-right-4 duration-300"
        >
          {current.art}
          <h2 id="onboarding-title" className="mt-6 font-display text-2xl font-semibold">
            {current.title}
          </h2>
          <p className="mt-2 text-sm text-muted">{current.body}</p>
          {current.action}
        </div>

        <div className="mt-7 flex items-center justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-accent" : "w-1.5 bg-line-strong",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="btn-ghost px-4"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          {last ? (
            <>
              <button type="button" onClick={() => finish()} className="btn-ghost flex-1">
                Later
              </button>
              <button type="button" onClick={() => finish(true)} className="btn-neon flex-[1.4]">
                <HeartPulse className="size-4" /> ADD NOW
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setStep(step + 1)} className="btn-neon flex-1">
              NEXT <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Looping demo of the hold-to-send ring. */
function SosArt() {
  return (
    <span className="relative grid size-28 place-items-center">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(var(--sos-fill) var(--onb-p, 0%), var(--color-line) 0)",
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 0)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 6px), #000 0)",
          animation: "onb-hold 2.4s var(--ease-out) infinite",
        }}
      />
      <span className="sos-btn pulse grid !size-[92px] place-items-center !text-lg">SOS</span>
    </span>
  );
}
