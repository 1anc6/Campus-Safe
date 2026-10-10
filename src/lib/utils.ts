import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId(): string {
  return crypto.randomUUID();
}

export function trackingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  // Crypto randomness: the code is the only credential for an anonymous report.
  // Rejection sampling keeps every character equally likely (no modulo bias).
  const limit = 256 - (256 % alphabet.length);
  const pick = (n: number) => {
    let out = "";
    while (out.length < n) {
      for (const b of crypto.getRandomValues(new Uint8Array(n))) {
        if (b < limit && out.length < n) out += alphabet[b % alphabet.length];
      }
    }
    return out;
  };
  return `CS-${pick(4)}-${pick(4)}`;
}

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export function waitLabel(fromIso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(fromIso).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function formatClock(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
