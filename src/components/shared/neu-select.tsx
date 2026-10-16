import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type NeuOption = {
  value: string;
  label: string;
  /** Secondary text shown muted beside the label (e.g. a building's zone). */
  hint?: string;
  /** Options sharing a group are listed under that heading. */
  group?: string;
};

/** Radix forbids "" as an item value; "All …" filters use it, so map it through. */
const EMPTY = "__empty__";
const enc = (v: string) => (v === "" ? EMPTY : v);
const dec = (v: string) => (v === EMPTY ? "" : v);

/**
 * Soft UI dropdown that replaces the platform <select> sheet: a pressed field
 * that opens a raised list cut from the same surface, with the chosen option
 * pressed in and checked. Keyboard, typeahead and screen readers come from Radix.
 */
export function NeuSelect({
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  size = "md",
  disabled,
  className,
  id,
  title,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: NeuOption[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const current = options.find((o) => o.value === value);
  // With no matching option (nothing picked yet) Radix needs "" to show the placeholder.
  const rootValue = current ? enc(value) : "";
  const groups = groupOptions(options);

  return (
    <Select.Root value={rootValue} onValueChange={(v) => onValueChange(dec(v))} disabled={disabled}>
      <Select.Trigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        className={cn(
          "input group flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-[color-mix(in_srgb,var(--color-neon)_55%,transparent)]",
          size === "sm" && "min-h-10 w-auto rounded-xl py-1.5 text-xs md:text-xs",
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <Select.Value placeholder={placeholder}>
            {current ? (
              <>
                {current.label}
                {current.hint && <span className="text-dim"> · {current.hint}</span>}
              </>
            ) : undefined}
          </Select.Value>
        </span>
        <Select.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className="neu-select-content z-[1300] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl bg-chrome shadow-[var(--neu-raised)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
        >
          <Select.ScrollUpButton className="flex h-7 items-center justify-center text-muted">
            <ChevronUp className="size-4" />
          </Select.ScrollUpButton>
          <Select.Viewport className="max-h-[min(22rem,var(--radix-select-content-available-height))] p-1.5">
            {groups.map(([group, items], gi) => (
              <Select.Group key={group ?? gi}>
                {group && (
                  <Select.Label className="neu-caps px-3 pb-1 pt-2.5 text-[10px]">
                    {group}
                  </Select.Label>
                )}
                {items.map((o) => (
                  <Select.Item
                    key={o.value}
                    value={enc(o.value)}
                    className={cn(
                      "relative flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-xl py-2 pl-3 pr-9 text-sm text-fg outline-none transition-[box-shadow,color] duration-150",
                      "data-[highlighted]:shadow-[var(--neu-raised-xs)] data-[highlighted]:text-neon",
                      "data-[state=checked]:font-semibold data-[state=checked]:text-neon data-[state=checked]:shadow-[var(--neu-inset-sm)]",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      size === "sm" && "min-h-9 text-xs",
                    )}
                  >
                    <Select.ItemText>{o.label}</Select.ItemText>
                    {o.hint && (
                      <span className="truncate text-xs font-normal text-dim">{o.hint}</span>
                    )}
                    <Select.ItemIndicator className="absolute right-3 inline-flex">
                      <Check className="size-4" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-7 items-center justify-center text-muted">
            <ChevronDown className="size-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function groupOptions(options: NeuOption[]): [string | undefined, NeuOption[]][] {
  const out: [string | undefined, NeuOption[]][] = [];
  for (const o of options) {
    const last = out[out.length - 1];
    if (last && last[0] === o.group) last[1].push(o);
    else out.push([o.group, [o]]);
  }
  return out;
}

/** Campus places grouped under their zone (Entry, Academic, Residence…), in campus order. */
export function placeOptions(
  places: readonly { id: string; name: string; zone: string }[],
): NeuOption[] {
  const zones = [...new Set(places.map((p) => p.zone))];
  return zones.flatMap((zone) =>
    places.filter((p) => p.zone === zone).map((p) => ({ value: p.id, label: p.name, group: zone })),
  );
}
