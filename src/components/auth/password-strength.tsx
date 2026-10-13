import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Live password strength meter for `/signup`: segmented bars, a strength label and
 * a requirements checklist. Adapted from the 21st.dev "Password Strength" component
 * (ddoemonn), with CSS transitions instead of `motion` and CampusSafe's tokens.
 * Only the length rule is enforced (by the form and the server); the rest is guidance.
 */

const COMMON =
  /^(?:password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|111111|123123|123456)/i;
const RUN = /(.)\1{3,}/;
const RUN_UP = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|asdf)/i;
const SYMBOL = /[!-/:-@[-`{-~]/;

const LABELS = ["Empty", "Weak", "Fair", "Good", "Strong"] as const;

type Rule = { id: string; label: string; test: (value: string) => boolean };

function rulesFor(minLength: number): Rule[] {
  return [
    {
      id: "length",
      label: `${minLength} characters or more`,
      test: (v) => v.length >= minLength,
    },
    { id: "case", label: "Upper and lower case", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
    { id: "digit", label: "A number", test: (v) => /\d/.test(v) },
    { id: "symbol", label: "A symbol", test: (v) => SYMBOL.test(v) },
  ];
}

const TONES = {
  none: { bar: "bg-line-strong", text: "text-muted" },
  danger: { bar: "bg-sos", text: "text-sos" },
  caution: { bar: "bg-warn", text: "text-warn" },
  safe: { bar: "bg-ok", text: "text-ok" },
} as const;

function toneFor(score: number, max: number) {
  if (score === 0) return TONES.none;
  const ratio = score / max;
  if (ratio <= 0.34) return TONES.danger;
  if (ratio <= 0.67) return TONES.caution;
  return TONES.safe;
}

export function PasswordStrength({
  id,
  value,
  minLength,
  className,
}: {
  /** Referenced by the password input's `aria-describedby`. */
  id?: string;
  value: string;
  minLength: number;
  className?: string;
}) {
  const rules = useMemo(() => rulesFor(minLength), [minLength]);
  const max = rules.length;

  const { score, evaluated, guessable, announcement } = useMemo(() => {
    const evaluated = rules.map((rule) => ({ ...rule, met: rule.test(value) }));
    const passed = evaluated.filter((r) => r.met).length;
    const guessable =
      value.length > 0 && (COMMON.test(value) || RUN.test(value) || RUN_UP.test(value));
    const score = value.length === 0 ? 0 : guessable ? 1 : Math.min(max, Math.max(1, passed));
    const unmet = evaluated.filter((r) => !r.met);
    const announcement =
      value.length === 0
        ? ""
        : [
            `Password strength ${LABELS[score].toLowerCase()}.`,
            guessable ? "This is a commonly guessed pattern." : "",
            unmet.length === 0
              ? "All requirements met."
              : `Still needed: ${unmet.map((r) => r.label.toLowerCase()).join(", ")}.`,
          ]
            .filter(Boolean)
            .join(" ");
    return { score, evaluated, guessable, announcement };
  }, [rules, max, value]);

  // Announce once typing settles, not on every keystroke.
  const [settled, setSettled] = useState("");
  useEffect(() => {
    if (!announcement) {
      setSettled("");
      return;
    }
    const t = setTimeout(() => setSettled(announcement), 700);
    return () => clearTimeout(t);
  }, [announcement]);

  const tone = toneFor(score, max);

  return (
    <div id={id} className={cn("w-full", className)}>
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={score}
        aria-valuetext={LABELS[score]}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="relative h-1.5 overflow-hidden rounded-full bg-[var(--auth-field-border)]"
          >
            <span
              className={cn(
                "absolute inset-0 origin-left rounded-full transition-[transform,background-color] duration-300 ease-[var(--ease-smooth-out)]",
                tone.bar,
              )}
              style={{
                transform: `scaleX(${i < score ? 1 : 0})`,
                transitionDelay: i < score ? `${i * 40}ms` : "0ms",
              }}
            />
          </span>
        ))}
      </div>

      <div className="mt-2 flex h-5 items-center justify-between gap-3 text-xs" aria-hidden="true">
        <span className={cn("font-semibold transition-colors duration-200", tone.text)}>
          {score === 0 ? "Password strength" : LABELS[score]}
        </span>
        <span
          className={cn(
            "text-warn transition-opacity duration-200",
            guessable ? "opacity-100" : "opacity-0",
          )}
        >
          Commonly guessed
        </span>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {evaluated.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2 text-xs">
            {/* A status mark, not a control: a muted dot that becomes a check once met. */}
            <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
              {rule.met ? (
                <Check className="size-3.5 text-ok" strokeWidth={3} />
              ) : (
                <span className="size-1.5 rounded-full bg-[var(--auth-placeholder)]" />
              )}
            </span>
            <span
              className={cn("transition-colors duration-200", rule.met ? "text-fg" : "text-muted")}
            >
              {rule.label}
            </span>
            <span className="sr-only">{rule.met ? "met" : "not met"}</span>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="sr-only">
        {settled}
      </p>
    </div>
  );
}
