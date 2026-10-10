import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "holding" | "armed";

/** How long the button must be held before the SOS countdown starts. */
const HOLD_MS = 2000;

/**
 * Hold-to-activate SOS. Arming runs on a real timer, so it fires on time even
 * when the browser throttles animation frames (battery saver, background tab);
 * animation frames only draw the progress ring. Works with touch, mouse, pen and
 * keyboard (hold Space or Enter). Releasing, cancelling or leaving the button
 * before the timer completes resets it.
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
  const ring = useRef<HTMLDivElement>(null);
  const armed = useRef(false);
  const holding = useRef(false);

  const setRing = (percent: number) => ring.current?.style.setProperty("--p", String(percent));

  const stop = useCallback(() => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    window.clearTimeout(timer.current);
  }, []);

  const reset = useCallback(() => {
    if (armed.current) return;
    const wasHolding = holding.current;
    stop();
    setPhase("idle");
    setRing(0);
    if (wasHolding) onReleasedEarly?.();
  }, [stop, onReleasedEarly]);

  const draw = useCallback(() => {
    if (!holding.current) return;
    setRing(Math.min((performance.now() - t0.current) / HOLD_MS, 1) * 100);
    raf.current = requestAnimationFrame(draw);
  }, []);

  const start = useCallback(() => {
    if (disabled || armed.current || holding.current) return;
    holding.current = true;
    t0.current = performance.now();
    setPhase("holding");
    try {
      navigator.vibrate?.(30);
    } catch {
      /* vibration unsupported */
    }
    draw();
    timer.current = window.setTimeout(() => {
      if (!holding.current) return;
      stop();
      armed.current = true;
      setRing(100);
      setPhase("armed");
      try {
        navigator.vibrate?.(60);
      } catch {
        /* vibration unsupported */
      }
      onArmed();
    }, HOLD_MS);
  }, [disabled, draw, stop, onArmed]);

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

  useEffect(() => stop, [stop]);

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
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") reset();
        }}
        onBlur={reset}
        aria-label="SOS. Hold for two seconds to send an emergency alert"
        aria-describedby={hintId}
      >
        SOS
      </button>
      <span id={hintId} className="sr-only">
        Press and hold for two seconds, with a finger or the Space key. Release early to stop.
      </span>
    </div>
  );
}
