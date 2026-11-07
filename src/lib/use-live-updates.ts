import { useEffect, useRef, useState } from "react";
import {
  matchesLiveFilter,
  parseLiveEvent,
  refreshDelay,
  streamHealthy,
  type LiveEvent,
  type LiveKind,
} from "./live";

/**
 * Browser side of real-time updates (rules in `live.ts`). Every screen on the
 * page shares ONE `EventSource` to `/api/live`; each screen says which kinds of
 * change it cares about and what to re-fetch.
 *
 *   useLiveUpdates({ kinds: ["sos"], id }, load, { fallbackMs: 5000 });
 *
 * While the stream is healthy the screen refreshes within about a second of a
 * change and does not poll. When the stream is down, unavailable or stale, the
 * old polling interval takes over automatically.
 */

type Listener = {
  kinds: readonly LiveKind[];
  id?: string;
  onEvent: () => void;
};

const STREAM_URL = "/api/live";
/** After the server refuses the stream (signed out, error), try again this much later. */
const REOPEN_MS = 15_000;
/** Keep the connection a moment after the last screen unmounts (route changes). */
const IDLE_CLOSE_MS = 3000;

const listeners = new Set<Listener>();
const state = { closed: true, lastMessageAt: null as number | null };
let source: EventSource | null = null;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
/** True when a fresh EventSource replaced one that died: changes may have been missed. */
let reopened = false;

function heard() {
  state.lastMessageAt = Date.now();
}

function notifyAll() {
  for (const l of listeners) l.onEvent();
}

function dispatch(ev: LiveEvent) {
  for (const l of listeners) {
    if (matchesLiveFilter(ev, { kinds: l.kinds, id: l.id })) l.onEvent();
  }
}

function open() {
  if (source || typeof window === "undefined" || typeof EventSource === "undefined") return;
  const es = new EventSource(STREAM_URL);
  source = es;
  state.closed = false;
  es.addEventListener("ready", (e) => {
    heard();
    let resync = false;
    try {
      resync = Boolean(
        (JSON.parse((e as MessageEvent<string>).data) as { resync?: unknown }).resync,
      );
    } catch {
      /* malformed: treat as no resync */
    }
    if (resync || reopened) notifyAll();
    reopened = false;
  });
  es.addEventListener("change", (e) => {
    heard();
    const ev = parseLiveEvent((e as MessageEvent<string>).data);
    if (ev) dispatch(ev);
  });
  es.addEventListener("ping", heard);
  es.onerror = () => {
    // CONNECTING: the browser reconnects by itself (and resumes from the last id).
    // CLOSED: the server refused (e.g. 401) — give up on this one and retry later.
    if (es.readyState !== EventSource.CLOSED) return;
    es.close();
    if (source === es) source = null;
    state.closed = true;
    state.lastMessageAt = null;
    reopened = true;
    if (!reopenTimer && listeners.size > 0) {
      reopenTimer = setTimeout(() => {
        reopenTimer = null;
        if (listeners.size > 0) open();
      }, REOPEN_MS);
    }
  };
}

function close() {
  source?.close();
  source = null;
  state.closed = true;
  state.lastMessageAt = null;
  if (reopenTimer) clearTimeout(reopenTimer);
  reopenTimer = null;
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  open();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && !idleTimer) {
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (listeners.size === 0) close();
      }, IDLE_CLOSE_MS);
    }
  };
}

/** Is the shared stream delivering right now (so polling can stay off)? */
export function liveStreamHealthy(): boolean {
  return streamHealthy(state, Date.now());
}

export type LiveUpdatesOptions = {
  /** Polling interval used only while the stream is not healthy (today's behaviour). */
  fallbackMs: number;
  /** At most one refresh per this many ms; a burst of changes becomes one refresh. */
  minGapMs?: number;
  /** Also refresh when the tab becomes visible and the stream is down. Default true. */
  refreshOnVisible?: boolean;
  /** Fallback poll to run instead of `refresh` (e.g. a cheaper "did anything change?" check). */
  fallback?: () => void;
};

/**
 * Re-run `refresh` when a matching change arrives; poll every `fallbackMs`
 * while the stream is down. Pass `null` as the filter to pause. Returns
 * whether the screen is currently on the live stream.
 */
export function useLiveUpdates(
  filter: { kinds: readonly LiveKind[]; id?: string } | null,
  refresh: () => unknown,
  { fallbackMs, minGapMs = 1000, refreshOnVisible = true, fallback }: LiveUpdatesOptions,
): boolean {
  const refreshRef = useRef(refresh);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    refreshRef.current = refresh;
    fallbackRef.current = fallback;
  });
  const [live, setLive] = useState(false);

  const kindsKey = filter ? filter.kinds.join(",") : null;
  const id = filter?.id;

  useEffect(() => {
    if (kindsKey === null) return;
    let lastRunAt: number | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      lastRunAt = Date.now();
      try {
        void Promise.resolve(refreshRef.current()).catch(() => {});
      } catch {
        /* a failed refresh is retried on the next change or poll */
      }
    };
    const onEvent = () => {
      if (pending) return;
      const wait = refreshDelay(lastRunAt, Date.now(), minGapMs);
      pending = setTimeout(() => {
        pending = null;
        run();
      }, wait);
    };
    const unsubscribe = subscribe({ kinds: kindsKey.split(",") as LiveKind[], id, onEvent });

    const poll = window.setInterval(() => {
      const healthy = liveStreamHealthy();
      setLive(healthy);
      if (healthy) return;
      if (fallbackRef.current) fallbackRef.current();
      else run();
    }, fallbackMs);
    // Reflect "live" quickly after the stream opens, without waiting a full poll interval.
    const status = window.setInterval(() => setLive(liveStreamHealthy()), 2000);
    const onVisible = () => {
      if (refreshOnVisible && document.visibilityState === "visible" && !liveStreamHealthy()) {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      if (pending) clearTimeout(pending);
      window.clearInterval(poll);
      window.clearInterval(status);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [kindsKey, id, fallbackMs, minGapMs, refreshOnVisible]);

  return live;
}
