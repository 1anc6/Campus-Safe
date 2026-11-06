import * as Popover from "@radix-ui/react-popover";
import { useRouterState } from "@tanstack/react-router";
import { BellOff, BellRing, Check, LoaderCircle, Share, X } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  disablePush,
  enablePush,
  getPushState,
  listenForServiceWorkerMessages,
  refreshPushSubscription,
  sendPushTest,
  type PushState,
} from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * Phone notifications UI.
 *
 * - `PushNotifications` (one per shell): keeps an existing subscription in sync
 *   and, a few seconds after the app opens, offers a small raised card asking
 *   whether to turn alerts on. The browser's own permission prompt only appears
 *   after "Turn on" is pressed — never on page load.
 * - `PushSettingsRow`: the same switch inside settings, so "Not now" is never final.
 */

export type PushAudience = "student" | "responder" | "admin";

const COPY: Record<PushAudience, { title: string; body: string }> = {
  student: {
    title: "Get SOS updates on this phone",
    body: "Know when a responder is assigned, when help arrives and when command replies, even with CampusSafe closed.",
  },
  responder: {
    title: "Get assigned SOS alerts instantly",
    body: "Your phone buzzes the moment command assigns an SOS to your unit, even with the app closed.",
  },
  admin: {
    title: "Get new SOS alerts on this device",
    body: "New SOS alerts, incidents and anonymous reports reach you even when this tab is closed.",
  },
};

// ── Shared state: the card and the settings row show the same thing. ────────
type Snapshot = { state: PushState | null };
let snapshot: Snapshot = { state: null };
const listeners = new Set<() => void>();
function setPushState(state: PushState) {
  if (snapshot.state === state) return;
  snapshot = { state };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const serverSnapshot: Snapshot = { state: null };

function usePush() {
  const { state } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<PushState | void>) => {
    setBusy(true);
    setNote(null);
    try {
      const next = await action();
      if (next) setPushState(next);
    } catch {
      setNote("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(
    () =>
      run(async () => {
        const r = await sendPushTest();
        setNote(
          r.sent > 0
            ? "Test sent. It should arrive in a few seconds."
            : "Couldn't reach this device. Turn notifications off and on again.",
        );
      }),
    [run],
  );

  return {
    state,
    busy,
    note,
    turnOn: () => run(enablePush),
    turnOff: () => run(disablePush),
    test,
  };
}

const DISMISS_KEY = "campussafe.push-prompt-dismissed";
/** "Not now" quiets the card for this long; settings still offer the switch. */
const DISMISS_MS = 14 * 24 * 3600_000;

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}
function rememberDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

/** Mount once per signed-in shell. */
export function PushNotifications({ audience }: { audience: PushAudience }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state, busy, note, turnOn, test } = usePush();
  const [visible, setVisible] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    let live = true;
    const sync = () =>
      void refreshPushSubscription()
        .catch(() => {})
        .then(() => getPushState())
        .then((s) => live && setPushState(s))
        .catch(() => {});
    sync();
    const stop = listenForServiceWorkerMessages(
      () =>
        void enablePush()
          .then(setPushState)
          .catch(() => {}),
    );
    // Wait until the screen has settled, and never on top of another dialog
    // (first-run onboarding, the SOS countdown): check again every 2 s.
    let t = 0;
    const reveal = (delay: number) => {
      t = window.setTimeout(() => {
        if (!live || dismissedRecently()) return;
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) reveal(2000);
        else setVisible(true);
      }, delay);
    };
    reveal(4000);
    return () => {
      live = false;
      stop();
      window.clearTimeout(t);
    };
  }, []);

  // Never cover a live SOS screen.
  const onSosScreen = pathname.startsWith("/sos/");
  const offer = state === "off" || state === "needs-install";
  if (!visible || onSosScreen || !(offer || justEnabled)) return null;

  const close = () => {
    if (!justEnabled) rememberDismiss();
    setVisible(false);
  };
  const copy = COPY[audience];

  return (
    <section
      aria-label="Phone notifications"
      className={cn(
        "glass fixed z-[35] flex gap-3 p-4 shadow-[var(--neu-raised)] animate-in fade-in-0 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none",
        "inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[380px]",
        audience === "student"
          ? "bottom-[calc(6.75rem+var(--safe-bottom))] md:bottom-6"
          : "bottom-[max(1rem,var(--safe-bottom))] sm:bottom-6",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-neon-dim text-neon">
        {justEnabled ? <Check className="size-5" /> : <BellRing className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        {justEnabled ? (
          <>
            <p className="font-display text-[15px] font-semibold leading-snug">
              Notifications are on
            </p>
            <p className="mt-1 text-sm text-muted">
              {note ?? "Send a test to see how alerts will look on this device."}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-neon h-10 px-4" disabled={busy} onClick={test}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Send a test
              </button>
              <button type="button" className="btn-ghost h-10 px-4" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : state === "needs-install" ? (
          <>
            <p className="font-display text-[15px] font-semibold leading-snug">{copy.title}</p>
            <p className="mt-1 text-sm text-muted">
              On iPhone, alerts work once CampusSafe is on your Home Screen: tap{" "}
              <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> then{" "}
              <span className="font-medium text-fg">Add to Home Screen</span>, and open it from
              there.
            </p>
            <div className="mt-3">
              <button type="button" className="btn-ghost h-10 px-4" onClick={close}>
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-[15px] font-semibold leading-snug">{copy.title}</p>
            <p className="mt-1 text-sm text-muted">{copy.body}</p>
            {note && (
              <p role="alert" className="mt-2 text-xs text-sos">
                {note}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-neon h-10 px-4"
                disabled={busy}
                onClick={() =>
                  void turnOn().then(() => {
                    if (snapshot.state === "on") setJustEnabled(true);
                    else if (snapshot.state === "denied") close();
                  })
                }
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Turn on
              </button>
              <button type="button" className="btn-ghost h-10 px-4" onClick={close}>
                Not now
              </button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-dim hover:bg-panel-2 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}

const HINT: Record<PushState, string> = {
  unsupported: "This browser can't show notifications from websites.",
  "needs-install": "Add CampusSafe to your Home Screen first, then turn this on there.",
  unconfigured: "Not available on this server yet.",
  denied: "Blocked for this site. Allow notifications in your browser's site settings.",
  off: "Alerts reach this device even when CampusSafe is closed.",
  on: "On for this device.",
};

/** Settings switch: turn on/off for this device, and send a test. */
export function PushSettingsRow({ className, compact }: { className?: string; compact?: boolean }) {
  const { state, busy, note, turnOn, turnOff, test } = usePush();
  if (state === null) return null;
  const on = state === "on";
  const actionable = state === "on" || state === "off";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            on ? "bg-neon-dim text-neon" : "bg-panel-2 text-dim",
          )}
        >
          {on ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-medium", compact ? "text-xs" : "text-sm")}>
            Phone notifications
          </span>
          <span className={cn("block text-muted", compact ? "text-[11px]" : "text-xs")}>
            {note ?? HINT[state]}
          </span>
        </span>
      </div>
      {actionable && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (on ? turnOff() : turnOn())}
            className={cn(on ? "btn-ghost" : "btn-neon", "h-9 flex-1 px-3 text-xs")}
            aria-pressed={on}
          >
            {busy && <LoaderCircle className="size-3.5 animate-spin" />}
            {on ? "Turn off" : "Turn on"}
          </button>
          {on && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void test()}
              className="btn-ghost h-9 flex-1 px-3 text-xs"
            >
              Send a test
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact bell button with the settings row in a popover (responder top bar). */
export function PushMenuButton({ className }: { className?: string }) {
  const { state } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
  if (state === null || state === "unsupported" || state === "unconfigured") return null;
  const on = state === "on";
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl text-muted hover:bg-panel-2 hover:text-fg data-[state=open]:bg-panel-2 data-[state=open]:text-fg",
          className,
        )}
        aria-label={on ? "Phone notifications: on" : "Phone notifications: off"}
      >
        {on ? <BellRing className="size-[18px] text-neon" /> : <BellOff className="size-[18px]" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[1200] w-[min(92vw,320px)] rounded-2xl bg-chrome p-4 shadow-[var(--neu-raised)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <PushSettingsRow />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
