import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  EyeOff,
  FileText,
  LayoutDashboard,
  Megaphone,
  Moon,
  Radio,
  Search,
  Smartphone,
  Truck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLive } from "@/backend/functions/admin";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Admin command palette (Ctrl/⌘ K): jump to any console page, open a live case,
 * or run a quick action. Adapted from the 21st.dev "Command Palette" component
 * (ddoemonn): its fuzzy ranking, combobox semantics and keyboard model are kept;
 * `motion` is replaced with CSS transitions and the styling uses CampusSafe tokens.
 */

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  shortcut?: string[];
  icon?: LucideIcon;
  tone?: "sos" | "violet";
  run: () => void;
};

const BOUNDARY = /[\s\-_/.:·]/;
const ROW = 40;
const GAP = 2;
const PAD = 6;

/** Subsequence score: rewards matches at word starts and consecutive runs; -1 = no match. */
function scoreOne(text: string, query: string): number {
  const t = text.toLowerCase();
  let cursor = 0;
  let total = 0;
  let streak = 0;
  for (let i = 0; i < query.length; i++) {
    const at = t.indexOf(query[i], cursor);
    if (at < 0) return -1;
    streak = at === cursor && i > 0 ? streak + 1 : 0;
    total += 2 + streak * 4;
    if (at === 0) total += 12;
    else if (BOUNDARY.test(t[at - 1])) total += 8;
    cursor = at + 1;
  }
  return total;
}

function rank(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const scored: { item: CommandItem; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const direct = scoreOne(item.label, q);
    const aliased = item.keywords ? scoreOne(item.keywords, q) - 3 : -1;
    const best = Math.max(direct, aliased);
    if (best < 0) return;
    scored.push({ item, score: best - item.label.length * 0.05, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.item);
}

export function CommandPalette({
  open,
  items,
  onDismiss,
  placeholder = "Search pages, cases and actions",
  emptyLabel = "Nothing matches",
  label = "Command palette",
  maxRows = 8,
}: {
  open: boolean;
  items: CommandItem[];
  onDismiss: () => void;
  placeholder?: string;
  emptyLabel?: string;
  label?: string;
  maxRows?: number;
}) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pointer = useRef({ x: -1, y: -1 });
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const results = useMemo(() => rank(items, query), [items, query]);
  const activeId = results.some((r) => r.id === pinned) ? pinned : (results[0]?.id ?? null);
  const activeIndex = results.findIndex((r) => r.id === activeId);

  // Fresh query each time it opens; focus the input, and give focus back on close.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setPinned(null);
    const t = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(t);
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Lock page scroll while open (keeping the scrollbar gutter so nothing jumps).
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const { overflow, paddingRight } = root.style;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    return () => {
      root.style.overflow = overflow;
      root.style.paddingRight = paddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const n = results.length;
      setAnnounce(n === 0 ? emptyLabel : `${n} ${n === 1 ? "result" : "results"}`);
    }, 400);
    return () => window.clearTimeout(t);
  }, [results.length, emptyLabel]);

  const reveal = (index: number) => {
    const list = listRef.current;
    const row = list?.children[index];
    if (!list || !(row instanceof HTMLElement)) return;
    const top = row.offsetTop - PAD;
    const bottom = row.offsetTop + row.offsetHeight + PAD;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  };

  const jump = (index: number) => {
    if (!results.length) return;
    const next = Math.max(0, Math.min(results.length - 1, index));
    setPinned(results[next].id);
    reveal(next);
  };

  const run = (item?: CommandItem) => {
    const target = item ?? results.find((r) => r.id === activeId);
    if (!target) return;
    onDismiss();
    target.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const from = activeIndex < 0 ? 0 : activeIndex;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      jump((from + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      jump((from - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      jump(0);
    } else if (e.key === "End") {
      e.preventDefault();
      jump(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDismiss();
    } else if (e.key === "Tab") {
      // Single-field dialog: keep focus inside it.
      e.preventDefault();
    }
  };

  if (!open || typeof document === "undefined") return null;

  const rows = Math.max(1, Math.min(maxRows, items.length));
  const height = PAD * 2 + rows * ROW + (rows - 1) * GAP;

  return createPortal(
    <div
      className="palette-layer fixed inset-0 z-[1100] flex items-start justify-center p-4 pt-[12vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[rgb(10_8_6/0.45)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="palette-panel glass-bar relative w-full max-w-[560px] overflow-hidden rounded-[22px]"
      >
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded
            aria-controls={`${uid}-list`}
            aria-autocomplete="list"
            aria-activedescendant={activeId ? `${uid}-${activeId}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-dim"
          />
          <kbd className="hidden shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs text-muted neu-raised-xs sm:inline">
            Esc
          </kbd>
        </div>
        <div className="relative" style={{ height }}>
          <ul
            ref={listRef}
            id={`${uid}-list`}
            role="listbox"
            aria-label={label}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-0 flex flex-col gap-[2px] overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]"
          >
            {results.map((item) => {
              const active = item.id === activeId;
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
                  id={`${uid}-${item.id}`}
                  role="option"
                  aria-selected={active}
                  onPointerMove={(e) => {
                    const { x, y } = pointer.current;
                    if (e.clientX === x && e.clientY === y) return;
                    pointer.current = { x: e.clientX, y: e.clientY };
                    if (!active) setPinned(item.id);
                  }}
                  onClick={() => run(item)}
                  className={cn(
                    "relative flex h-10 shrink-0 cursor-pointer items-center gap-3 rounded-[12px] px-3 transition-colors duration-150",
                    active ? "bg-panel-3" : "bg-transparent",
                  )}
                >
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        item.tone === "sos"
                          ? "text-sos"
                          : item.tone === "violet"
                            ? "text-violet"
                            : active
                              ? "text-neon"
                              : "text-muted",
                      )}
                    />
                  )}
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  {item.hint && (
                    <span className="hidden shrink-0 truncate text-xs text-muted sm:inline">
                      {item.hint}
                    </span>
                  )}
                  {item.shortcut && (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {item.shortcut.map((key) => (
                        <kbd
                          key={key}
                          className="flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-xs text-muted neu-raised-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {results.length === 0 && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm text-muted">
              {emptyLabel}
            </p>
          )}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
      </div>
    </div>,
    document.body,
  );
}

const PAGES: {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  tone?: "sos" | "violet";
}[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, keywords: "home command overview" },
  {
    to: "/admin/sos",
    label: "SOS alerts",
    icon: Radio,
    keywords: "emergency map live",
    tone: "sos",
  },
  { to: "/admin/incidents", label: "Incidents", icon: FileText, keywords: "reports cases" },
  { to: "/admin/anonymous", label: "Anonymous reports", icon: EyeOff, tone: "violet" },
  {
    to: "/admin/alerts",
    label: "Broadcasts",
    icon: Megaphone,
    keywords: "campus alert notify send",
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    keywords: "accounts students roles new account",
  },
  { to: "/admin/responders", label: "Responders", icon: Truck, keywords: "units security medical" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, keywords: "charts stats trends" },
  { to: "/staff", label: "Responder field app", icon: Smartphone, keywords: "staff field" },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const PALETTE_SHORTCUT = IS_MAC ? ["⌘", "K"] : ["Ctrl", "K"];

/** The palette's keyboard shortcut as key caps (for the header search button). */
export function PaletteShortcutKeys({ className }: { className?: string }) {
  return (
    <span className={cn("items-center gap-1", className)} aria-hidden="true">
      {PALETTE_SHORTCUT.map((k) => (
        <kbd key={k} className="rounded-md px-1.5 py-0.5 font-mono text-xs neu-raised-xs">
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** The palette wired to the admin console: pages, open cases (loaded on open) and actions. */
export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const [cases, setCases] = useState<CommandItem[]>([]);

  // Ctrl/⌘ K toggles it from anywhere in the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Open cases are fetched each time it opens, so the list is never stale.
  useEffect(() => {
    if (!open) return;
    let live = true;
    getLive()
      .then((d) => {
        if (!live) return;
        setCases(
          d.queue.map((q) => ({
            id: `case-${q.kind}-${q.id}`,
            label: q.kind === "sos" ? `SOS · ${q.title}` : q.title,
            hint: [q.severity, q.place].filter(Boolean).join(" · "),
            keywords: `${q.kind} ${q.place ?? ""} ${q.severity}`,
            icon: q.kind === "sos" ? Radio : q.kind === "anonymous" ? EyeOff : FileText,
            tone:
              q.kind === "sos"
                ? ("sos" as const)
                : q.kind === "anonymous"
                  ? ("violet" as const)
                  : undefined,
            run: () =>
              void navigate(
                q.kind === "sos"
                  ? { to: "/admin/sos/$id", params: { id: q.id } }
                  : q.kind === "incident"
                    ? { to: "/admin/incidents/$id", params: { id: q.id } }
                    : { to: "/admin/anonymous" },
              ),
          })),
        );
      })
      .catch(() => live && setCases([]));
    return () => {
      live = false;
    };
  }, [open, navigate]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const items = useMemo<CommandItem[]>(
    () => [
      ...PAGES.map((p) => ({
        id: `page-${p.to}`,
        label: p.label,
        hint: "Page",
        keywords: p.keywords,
        icon: p.icon,
        tone: p.tone,
        run: () => void navigate({ to: p.to }),
      })),
      ...cases,
      {
        id: "action-theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        hint: "Action",
        keywords: "theme appearance dark light",
        icon: Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
    [cases, navigate, theme],
  );

  return <CommandPalette open={open} items={items} onDismiss={close} />;
}
