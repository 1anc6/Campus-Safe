import { createHash, randomBytes } from "node:crypto";
import { getRequestIP } from "@tanstack/react-start/server";

/**
 * Small in-memory sliding-window rate limiter for abuse-prone endpoints.
 *
 * Limits are per server instance: good enough to stop scripted floods and
 * tracking-code guessing on one box; on multiple instances (serverless) move
 * the counters to a shared store such as Redis/Upstash with the same keys.
 */

const g = globalThis as typeof globalThis & {
  __rateLimitHits__?: Map<string, number[]>;
  __rateLimitSalt__?: string;
};
const hits = (g.__rateLimitHits__ ??= new Map<string, number[]>());
// Per-process random salt: IP keys can't be reversed or linked across restarts.
const salt = (g.__rateLimitSalt__ ??= randomBytes(16).toString("hex"));

export class RateLimitError extends Error {
  constructor(message = "Too many requests. Please wait a few minutes and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Throws `RateLimitError` once `key` has been used `max` times within `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw new RateLimitError();
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) prune(now);
}

function prune(now: number) {
  for (const [k, times] of hits) {
    if (!times.length || now - times[times.length - 1] > 3_600_000) hits.delete(k);
  }
}

/**
 * Rate-limit key for anonymous endpoints: a salted hash of the caller's IP that
 * lives only in memory. The anonymous report itself never stores it.
 */
export function anonymousCallerKey(scope: string): string {
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    /* no request context (tests) */
  }
  return `${scope}:${createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 24)}`;
}
