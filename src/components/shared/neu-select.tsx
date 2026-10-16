import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

export type NeuOption = {
  value: string;
  label: string;
  /** Secondary text shown muted beside the label (e.g. a building's zone). */
  hint?: string;
  /** Options sharing a group are listed under that heading. */
  group?: string;
};

type NeuSelectProps = {
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
};

/** Radix forbids "" as an item value; "All …" filters use it, so map it through. */
const EMPTY = "__empty__";
const enc = (v: string) => (v === "" ? EMPTY : v);
const dec = (v: string) => (v === EMPTY ? "" : v);

/** Touch phones get a bottom sheet; everything else gets the anchored list. */
const PHONE_QUERY = "(max-width: 639px) and (pointer: coarse)";
function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

const TRIGGER =
  "input group flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-[color-mix(in_srgb,var(--color-neon)_55%,transparent)]";
const TRIGGER_SM = "min-h-10 w-auto rounded-xl py-1.5 text-xs md:text-xs";

/**
 * Soft UI dropdown that replaces the platform <select> sheet: a pressed field
 * that opens a raised list cut from the same surface, with the chosen option
 * pressed in and checked. On touch phones the list is a bottom sheet (Vaul)
 * that follows the finger and can be flicked away.
 */
export function NeuSelect(props: NeuSelectProps) {
  const phone = useIsPhone();
  return phone ? <SheetSelect {...props} /> : <PopoverSelect {...props} />;
}

/** Anchored list: grows out of its trigger, keyboard and typeahead from Radix. */
function PopoverSelect({
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
}: NeuSelectProps) {
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
        className={cn(TRIGGER, size === "sm" && TRIGGER_SM, className)}
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
          <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 ease-[var(--ease-out)] group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className="z-[1300] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded-2xl bg-chrome shadow-[var(--neu-raised)] duration-150 ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100"
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

/** Phone bottom sheet: drag or flick down to dismiss, tap an option to choose. */
function SheetSelect({
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
}: NeuSelectProps) {
  const [open, setOpen] = useState(false);
  const chosen = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);
  const groups = groupOptions(options);
  const heading = ariaLabel ?? placeholder;

  // Open on the chosen option, not the top of a long list.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => chosen.current?.scrollIntoView({ block: "center" }), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          id={id}
          title={title}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          data-state={open ? "open" : "closed"}
          className={cn(TRIGGER, size === "sm" && TRIGGER_SM, className)}
        >
          <span className={cn("min-w-0 truncate", !current && "text-dim")}>
            {current ? (
              <>
                {current.label}
                {current.hint && <span className="text-dim"> · {current.hint}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1300] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[1301] flex max-h-[82dvh] flex-col rounded-t-[28px] bg-chrome pb-[max(0.75rem,var(--safe-bottom))] shadow-[var(--neu-raised)] outline-none"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-[var(--neu-track)]"
          />
          <Drawer.Title className="px-5 pb-1 pt-3 font-display text-base font-semibold">
            {heading}
          </Drawer.Title>
          <div
            role="listbox"
            aria-label={heading}
            className="overflow-y-auto overscroll-contain px-3 pb-2 pt-1"
          >
            {groups.map(([group, items], gi) => (
              <div key={group ?? gi} role="group" aria-label={group}>
                {group && <p className="neu-caps px-3 pb-1 pt-3 text-[10px]">{group}</p>}
                {items.map((o) => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      ref={on ? chosen : undefined}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        onValueChange(o.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "relative flex min-h-12 w-full items-center gap-2 rounded-2xl py-2.5 pl-3.5 pr-10 text-left text-[15px] text-fg",
                        on && "font-semibold text-neon shadow-[var(--neu-inset-sm)]",
                      )}
                    >
                      {o.label}
                      {o.hint && (
                        <span className="truncate text-xs font-normal text-dim">{o.hint}</span>
                      )}
                      {on && <Check className="absolute right-3.5 size-4" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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
