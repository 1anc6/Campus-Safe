import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "holding" | "confirm" | "armed";

/** How long the button must be held before the SOS countdown starts. */
const HOLD_MS = 2000;
/** After a short press, a second press within this window also starts the countdown. */
const CONFIRM_MS = 5000;
/** A click this soon after a pointer or key press belongs to that press. */
const PRESS_CLICK_MS = 800;

/** What a screen reader hears as the button changes state. */
const ANNOUNCE: Record<Phase, string> = {
  idle: "",
  holding: "Keep holding to send SOS.",
  confirm: "Press SOS again to send an emergency alert, or hold it for two seconds.",
  armed: "SOS starting.",
};

/**
 * Hold-to-activate SOS. Arming runs on a real timer, so it fires on time even
 * when the browser throttles animation frames (battery saver, background tab);
 * animation frames only draw the progress ring. Works with touch, mouse, pen and
 * keyboard (hold Space or Enter). Releasing, cancelling or leaving the button
 * before the timer completes resets it.
 *
 * Not everyone can hold a press (tremor, switch access, a screen reader's
 * double-tap), so a second press within a few seconds of a short one also arms
 * it (WCAG 2.1.1 / 2.5.1). Either way the 5-second countdown that follows can
 * still be cancelled. State changes are announced through a live region.
 */
export function SosButton({
  onArmed,
  onReleasedEarly,
  disabled,
  size = "lg",
  className,
}: {
  onArmed: () => void;
  /** A hold let go before it armed (e.g. a quick tap) — a chance to explain "hold". */
  onReleasedEarly?: () => void;
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const hintId = useId();
  const t0 = useRef(0);
  const raf = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const confirmTimer = useRef<number | undefined>(undefined);
  const ring = useRef<HTMLDivElement>(null);
  const armed = useRef(false);
  const holding = useRef(false);
  /** Until when a second press arms the SOS (ms epoch, 0 = not waiting). */
  const confirmUntil = useRef(0);
  /** This press started inside the confirm window. */
  const secondPress = useRef(false);
  /** When the last pointer/key press ended, to tell its click from an assistive-tech click. */
  const lastPressEnd = useRef(0);

  const setRing = (percent: number) => ring.current?.style.setProperty("--p", String(percent));

  const stop = useCallback(() => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    window.clearTimeout(timer.current);
  }, []);

  const fire = useCallback(() => {
    stop();
    window.clearTimeout(confirmTimer.current);
    confirmUntil.current = 0;
    armed.current = true;
    setRing(100);
    setPhase("armed");
    try {
      navigator.vibrate?.(60);
    } catch {
      /* vibration unsupported */
    }
    onArmed();
  }, [stop, onArmed]);

  /** A short press: wait a few seconds for a second one. */
  const awaitSecondPress = useCallback(() => {
    confirmUntil.current = Date.now() + CONFIRM_MS;
    setPhase("confirm");
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => {
      confirmUntil.current = 0;
      setPhase((p) => (p === "confirm" ? "idle" : p));
    }, CONFIRM_MS);
    onReleasedEarly?.();
  }, [onReleasedEarly]);

  const reset = useCallback(() => {
    if (armed.current) return;
    const wasHolding = holding.current;
    stop();
    setRing(0);
    if (!wasHolding) return;
    lastPressEnd.current = performance.now();
    if (secondPress.current) {
      fire();
      return;
    }
    awaitSecondPress();
  }, [stop, fire, awaitSecondPress]);

  const draw = useCallback(() => {
    if (!holding.current) return;
    setRing(Math.min((performance.now() - t0.current) / HOLD_MS, 1) * 100);
    raf.current = requestAnimationFrame(draw);
  }, []);

  const start = useCallback(() => {
    if (disabled || armed.current || holding.current) return;
    holding.current = true;
    secondPress.current = Date.now() < confirmUntil.current;
    t0.current = performance.now();
    setPhase("holding");
    try {
      navigator.vibrate?.(30);
    } catch {
      /* vibration unsupported */
    }
    draw();
    timer.current = window.setTimeout(() => {
      if (holding.current) fire();
    }, HOLD_MS);
  }, [disabled, draw, fire]);

  const down = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || armed.current) return;
      e.preventDefault();
      // Keep receiving events if the finger drifts; never let a capture failure
      // stop an emergency hold from starting.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable — the hold still works while over the button */
      }
      start();
    },
    [disabled, start],
  );

  /**
   * A click with no press before it comes from assistive technology (a screen
   * reader's double-tap, switch or voice control): treat it as one short press.
   */
  const click = useCallback(() => {
    if (disabled || armed.current || holding.current) return;
    if (performance.now() - lastPressEnd.current < PRESS_CLICK_MS) return;
    if (Date.now() < confirmUntil.current) fire();
    else awaitSecondPress();
  }, [disabled, fire, awaitSecondPress]);

  useEffect(
    () => () => {
      stop();
      window.clearTimeout(confirmTimer.current);
    },
    [stop],
  );

  return (
    <div className={cn("sos-wrap mx-auto", size !== "lg" && `sos-${size}`, className)}>
      <div ref={ring} className="sos-ring" />
      <button
        type="button"
        className={cn("sos-btn", phase === "idle" && !disabled && "pulse")}
        disabled={disabled}
        onPointerDown={down}
        onPointerUp={reset}
        onPointerCancel={reset}
        onPointerLeave={reset}
        onClick={click}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            reset();
          }
        }}
        onBlur={reset}
        aria-label="SOS. Hold for two seconds to send an emergency alert"
        aria-describedby={hintId}
      >
        SOS
      </button>
      <span id={hintId} className="sr-only">
        Press and hold for two seconds, with a finger or the Space key, or press it twice. Release
        early to stop.
      </span>
      <span className="sr-only" role="status" aria-live="assertive">
        {ANNOUNCE[phase]}
      </span>
    </div>
  );
}
