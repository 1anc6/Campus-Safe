import { createHash, randomBytes } from "node:crypto";
import { getRequestIP } from "@tanstack/react-start/server";

/**
 * Rate limiter for abuse-prone endpoints.
 *
 * With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set (production), the
 * counters live in Redis, so every serverless instance shares one limit — a
 * fixed window per key, via Upstash's REST API (no client library needed).
 * Without them (local dev), an in-memory sliding window per instance is used.
 * If Redis is unreachable the in-memory limiter takes over for that call, so an
 * outage never blocks students from reporting.
 */

const g = globalThis as typeof globalThis & {
  __rateLimitHits__?: Map<string, number[]>;
  __rateLimitSalt__?: string;
};
const hits = (g.__rateLimitHits__ ??= new Map<string, number[]>());
// Fallback salt when RATE_LIMIT_SALT is unset: per process, so keys can't be linked across restarts.
const processSalt = (g.__rateLimitSalt__ ??= randomBytes(16).toString("hex"));

export class RateLimitError extends Error {
  constructor(message = "Too many requests. Please wait a few minutes and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Throws `RateLimitError` once `key` has been used `max` times within `windowMs`. */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<void> {
  const redis = redisConfig();
  if (redis) {
    const count = await redisHit(redis, key, windowMs).catch((err: unknown) => {
      console.error("[rate-limit] Redis unavailable, using in-memory limiter:", err);
      return null;
    });
    if (count !== null) {
      if (count > max) throw new RateLimitError();
      return;
    }
  }
  memoryHit(key, max, windowMs);
}

/**
 * INCR this window's counter and (re)set its expiry; returns the new count. The
 * window is part of the key, so refreshing the expiry never stretches a window.
 */
async function redisHit(
  redis: { url: string; token: string },
  key: string,
  windowMs: number,
): Promise<number> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  const res = await fetch(`${redis.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", bucket],
      ["PEXPIRE", bucket, String(windowMs)],
    ]),
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const count = Number(out[0]?.result);
  if (out[0]?.error || !Number.isFinite(count)) throw new Error(out[0]?.error ?? "Bad reply");
  return count;
}

function memoryHit(key: string, max: number, windowMs: number) {
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
 * Salt for IP keys. With RATE_LIMIT_SALT set, every instance derives the same
 * salt for the day (so a shared Redis limit works across instances), and it
 * rotates daily, so a key can't be linked to the same IP on another day.
 */
function ipSalt(): string {
  const secret = process.env.RATE_LIMIT_SALT?.trim();
  if (!secret) return processSalt;
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(secret).update(day).digest("hex");
}

/**
 * Rate-limit key for anonymous endpoints: a salted hash of the caller's IP. The
 * raw IP is never stored, and the anonymous report itself never sees it.
 */
export function anonymousCallerKey(scope: string): string {
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    /* no request context (tests) */
  }
  return `${scope}:${createHash("sha256").update(ipSalt()).update(ip).digest("hex").slice(0, 24)}`;
}
