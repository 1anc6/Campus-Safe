import { createFileRoute, Link } from "@tanstack/react-router";
import { requireRole } from "@/lib/auth/guards";
import { LiveMap } from "@/components/shared/live-map";
import { StatusStepper } from "@/components/shared/status-stepper";
import { SOS_STEPS } from "@/lib/campus";
import { getFix, GOOD_FIX_M, gpsBlockedByInsecureOrigin } from "@/lib/gps";
import { getSos, markSosSafe, pingSosLocation, replySos } from "@/backend/functions/sos";
import { ChatThread } from "@/components/shared/chat-thread";
import { cn, waitLabel } from "@/lib/utils";
import type { SosAlert, SosPoint, ThreadMessage } from "@/lib/types";
import { ArrowLeft, Crosshair, MapPinOff, Phone, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Minimum gap between GPS uploads, and the heartbeat that re-sends the last fix. */
const PING_EVERY_MS = 7000;
const HEARTBEAT_MS = 20000;
const FALLBACK_EVERY_MS = 30000;
/**
 * A reading this many times less accurate than the last one sent is a coarse
 * Wi-Fi/cell estimate, not movement: skip it while the good fix is still fresh.
 */
const WORSE_FACTOR = 2;
const GOOD_FIX_FRESH_MS = 60_000;
/** Students can still add to the conversation for a day after the alert closes. */
const REPLY_GRACE_MS = 24 * 60 * 60_000;

/** One-tap answers for the questions command asks most, written for a scared thumb. */
const STUDENT_QUICK_REPLIES = [
  "Someone is following me",
  "I'm hurt, I need medical help",
  "I can't talk, text only",
  "I'm hiding, please hurry",
  "I'm with a friend",
];

type Sharing = "starting" | "live" | "approx" | "blocked" | "insecure";

/** Focused, full-screen live SOS view (no app chrome) for the student who raised it. */
export const Route = createFileRoute("/sos/$id")({
  beforeLoad: requireRole(["student"]),
  component: Active,
});

function Active() {
  const { id } = Route.useParams();
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const [trail, setTrail] = useState<SosPoint[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const watchRef = useRef<number | null>(null);
  const lastPing = useRef(0);
  const lastFallback = useRef(0);
  /** When the last real (non-approximate) reading was accepted. */
  const lastRealAt = useRef(0);
  const lastFix = useRef<{ lat: number; lng: number; acc: number | null; approx: boolean } | null>(
    null,
  );
  const wake = useRef<WakeLockSentinel | null>(null);
  const alertRef = useRef<SosAlert | null>(null);
  const [sharing, setSharing] = useState<Sharing>("starting");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [error, setError] = useState<string | null>(null);

  /** Staff messages already seen, so only new replies buzz the phone. */
  const seenStaff = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const data = await getSos({ data: { id } });
    alertRef.current = data.alert;
    setAlert(data.alert);
    setTrail(data.trail);
    setMessages(data.messages);
    const staff = data.messages.filter(
      (m) => m.authorRole === "admin" || m.authorRole === "responder",
    );
    if (seenStaff.current != null && staff.length > seenStaff.current) {
      const latest = staff[staff.length - 1]!;
      try {
        navigator.vibrate?.([80, 60, 80]);
      } catch {
        /* vibration unsupported */
      }
      toast(latest.authorRole === "responder" ? "Responder" : "Campus command", {
        description: latest.body,
      });
    }
    seenStaff.current = staff.length;
    return data.alert;
  }, [id]);

  useEffect(() => {
    let live = true;
    refresh()
      .catch(() => {
        setError("This alert could not be found.");
        return null;
      })
      .then((a) => {
        if (!live || !a) return;
        if (a.status === "resolved" || a.status === "cancelled") return;
        // Start from the fix the alert was sent with, so the phone's first coarse
        // reading after opening this screen can't replace it.
        if (a.lat != null && a.lng != null && !a.isApproximate) {
          lastFix.current = { lat: a.lat, lng: a.lng, acc: a.accuracyM, approx: false };
          lastRealAt.current = Date.now();
        }
        navigator.wakeLock
          ?.request("screen")
          .then((s) => {
            wake.current = s;
          })
          .catch(() => {});
        const send = (fix: { lat: number; lng: number; acc: number | null; approx: boolean }) => {
          lastPing.current = Date.now();
          lastFix.current = fix;
          void pingSosLocation({ data: { id, ...fix } })
            .then(() => {
              setSentAt(Date.now());
              return refresh();
            })
            .catch(() => {});
        };
        if (gpsBlockedByInsecureOrigin()) setSharing("insecure");
        if ("geolocation" in navigator && !gpsBlockedByInsecureOrigin()) {
          watchRef.current = navigator.geolocation.watchPosition(
            (p) => {
              setSharing("live");
              setAccuracy(p.coords.accuracy);
              const fix = {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                acc: p.coords.accuracy,
                approx: false,
              };
              const prev = lastFix.current;
              const prevFresh = Date.now() - lastRealAt.current < GOOD_FIX_FRESH_MS;
              const muchWorse =
                prev != null &&
                !prev.approx &&
                prev.acc != null &&
                fix.acc > Math.max(GOOD_FIX_M, prev.acc * WORSE_FACTOR);
              if (muchWorse && prevFresh) return;
              // Send at once when accuracy clearly improved (e.g. GPS just locked);
              // otherwise at most every PING_EVERY_MS.
              const improved =
                prev != null && (prev.approx || (prev.acc ?? Infinity) > fix.acc * WORSE_FACTOR);
              lastRealAt.current = Date.now();
              if (!improved && Date.now() - lastPing.current < PING_EVERY_MS) return;
              send(fix);
            },
            (err) => {
              setSharing(err.code === err.PERMISSION_DENIED ? "blocked" : "approx");
              // Rate-limit fallback pings: error callbacks can fire repeatedly.
              if (Date.now() - lastFallback.current < FALLBACK_EVERY_MS) return;
              lastFallback.current = Date.now();
              // Never replace a real position command already has with a guess;
              // the heartbeat keeps re-sending the last real fix instead.
              const hasPosition = alertRef.current?.lat != null && !alertRef.current.isApproximate;
              if (hasPosition || (lastFix.current && !lastFix.current.approx)) return;
              void getFix(4000).then((f) => send(f));
            },
            { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
          );
        }
      });
    // Heartbeat: a phone standing still may stop reporting positions. Re-send the
    // last fix so command can tell "still here" from "signal lost".
    const heartbeat = window.setInterval(() => {
      if (lastFix.current && Date.now() - lastPing.current >= HEARTBEAT_MS) {
        const fix = lastFix.current;
        lastPing.current = Date.now();
        void pingSosLocation({ data: { id, ...fix } })
          .then(() => setSentAt(Date.now()))
          .catch(() => {});
      }
    }, 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => void refresh().catch(() => {}), 5000);
    return () => {
      live = false;
      window.clearInterval(poll);
      window.clearInterval(heartbeat);
      window.clearInterval(tick);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      void wake.current?.release();
    };
  }, [id, refresh]);

  async function safe() {
    await markSosSafe({ data: { id } });
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    lastFix.current = null;
    void wake.current?.release();
    await refresh();
  }

  if (!alert) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        {error ? (
          <div>
            <p className="text-sm text-sos">{error}</p>
            <Link to="/" className="btn-ghost mt-4">
              Back to home
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted" role="status">
            Connecting to command…
          </p>
        )}
      </div>
    );
  }

  const closed = alert.status === "resolved" || alert.status === "cancelled";
  const markedSafe = messages.some(
    (m) => m.authorRole === "system" && m.body.startsWith("Reporter marked themselves safe"),
  );
  const canReply =
    !closed || (alert.resolvedAt != null && now - Date.parse(alert.resolvedAt) < REPLY_GRACE_MS);
  const currentId =
    alert.status === "resolved" ? "resolved" : alert.status === "cancelled" ? "sent" : alert.status;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col pb-safe pt-safe">
      <div className="px-5 pt-3">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
      </div>
      <header className="px-5 pt-2 text-center">
        <h1 className="font-display text-3xl font-semibold">
          {!closed
            ? "Help is on the way"
            : alert.status === "cancelled"
              ? "SOS cancelled"
              : markedSafe
                ? "You are marked safe"
                : "Campus command resolved your alert"}
        </h1>
        {!closed && (
          <SharingBanner sharing={sharing} accuracy={accuracy} sentAt={sentAt} now={now} />
        )}
      </header>

      <div className="md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start md:gap-2">
        <div className="mx-5 mt-5 h-56 overflow-hidden rounded-2xl neu-raised-xs sm:h-72 md:h-[28rem]">
          <LiveMap
            markers={
              alert.lat != null && alert.lng != null
                ? [
                    {
                      id: alert.id,
                      lat: alert.lat,
                      lng: alert.lng,
                      kind: "self",
                      label: "You",
                      accuracyM: alert.accuracyM,
                    },
                  ]
                : []
            }
            trail={trail}
            focus={
              alert.lat != null && alert.lng != null ? { lat: alert.lat, lng: alert.lng } : null
            }
            className="h-full w-full"
          />
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="card p-4">
            <StatusStepper steps={stepsFor(alert, markedSafe)} current={currentId} />
          </div>

          {alert.assignedName && (
            <div className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs text-muted">Responder</p>
                <p className="truncate font-display font-semibold">{alert.assignedName}</p>
                {alert.assignedPhone && <p className="text-xs text-muted">{alert.assignedPhone}</p>}
              </div>
              {alert.assignedPhone && (
                <a
                  href={`tel:${alert.assignedPhone}`}
                  aria-label={`Call ${alert.assignedName}`}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-ok text-ink shadow-[var(--neu-raised-xs)]"
                >
                  <Phone className="size-5" />
                </a>
              )}
            </div>
          )}

          <ChatThread
            messages={messages}
            selfRoles={["reporter"]}
            labels={{ reporter: "You", admin: "Campus command", responder: "Responder" }}
            quickReplies={closed ? [] : STUDENT_QUICK_REPLIES}
            placeholder="Message campus command"
            disabled={!canReply}
            disabledNote="This alert closed over a day ago. File a report to raise anything new."
            onSend={async (body) => {
              await replySos({ data: { id, body } });
              await refresh();
            }}
          />

          {!closed && (
            <button
              type="button"
              onClick={() => void safe()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ok font-display text-lg font-bold text-ink shadow-[var(--neu-raised-sm)] transition-transform active:scale-[0.99]"
            >
              <ShieldCheck className="size-5" /> I'm safe
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const SHARING_COPY: Record<Sharing, string> = {
  starting: "Finding your location…",
  live: "Sharing your live location with campus command",
  approx: "GPS is weak — sharing an approximate location",
  blocked: "Location permission is off — allow it in your browser so responders can find you",
  insecure: "Live GPS needs a secure (https) connection — command sees an approximate location",
};

function SharingBanner({
  sharing,
  accuracy,
  sentAt,
  now,
}: {
  sharing: Sharing;
  accuracy: number | null;
  sentAt: number | null;
  now: number;
}) {
  const ok = sharing === "live" || sharing === "starting";
  return (
    <div
      role="status"
      className={cn(
        "neu-well mx-auto mt-3 flex max-w-md items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-xs",
        ok ? "text-ok" : "text-warn",
      )}
    >
      {ok ? <Crosshair className="size-4 shrink-0" /> : <MapPinOff className="size-4 shrink-0" />}
      <span>
        {SHARING_COPY[sharing]}
        {sharing === "live" && accuracy != null && ` · ±${Math.round(accuracy)} m`}
        {sentAt && ` · updated ${waitLabel(new Date(sentAt).toISOString(), now)} ago`}
      </span>
    </div>
  );
}

/**
 * Steps that actually happened. A closed alert only lists the stages it reached,
 * so marking yourself safe never claims a responder was assigned or arrived.
 */
function stepsFor(alert: SosAlert, markedSafe: boolean) {
  const all = SOS_STEPS.filter((s) => s.id !== "cancelled");
  if (alert.status !== "resolved") return all;
  return all
    .filter((s) =>
      s.id === "assigned" ? alert.assignedAt : s.id === "arrived" ? alert.arrivedAt : true,
    )
    .map((s) =>
      s.id === "resolved" && markedSafe ? { ...s, label: "You marked yourself safe" } : s,
    );
}
