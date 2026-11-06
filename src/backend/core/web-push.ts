import {
  createECDH,
  createHmac,
  createCipheriv,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";
import { isAllowedPushEndpoint } from "../../lib/push-endpoint.ts";

export { isAllowedPushEndpoint };

/**
 * Standard Web Push, implemented on Node's own crypto (no extra dependency):
 *
 * - **Message encryption** — RFC 8291 + RFC 8188 (`aes128gcm`). Only the
 *   browser that subscribed holds the private key, so the push service (Google,
 *   Mozilla, Apple, Microsoft) relays the notification without being able to read it.
 * - **VAPID** — RFC 8292. A short-lived ES256-signed JWT proves to the push
 *   service that the message comes from this server (the key pair whose public
 *   half the browser was given when it subscribed).
 *
 * Pure functions only (no database, no env), so they are unit-tested against
 * the RFC 8291 worked example in `web-push.test.ts`.
 */

export type PushSubscriptionKeys = {
  endpoint: string;
  /** The browser's P-256 public key (65-byte uncompressed point), base64url. */
  p256dh: string;
  /** The browser's 16-byte auth secret, base64url. */
  auth: string;
};

export type VapidKeys = {
  /** 65-byte uncompressed P-256 public key, base64url (what browsers call applicationServerKey). */
  publicKey: string;
  /** 32-byte P-256 private scalar, base64url. */
  privateKey: string;
  /** `mailto:` or `https:` contact for the push service operators. */
  subject: string;
};

export function b64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function hmac(key: Uint8Array, ...data: Uint8Array[]): Buffer {
  const h = createHmac("sha256", key);
  for (const d of data) h.update(d);
  return h.digest();
}

/** HKDF (RFC 5869) for outputs of at most one hash block, which is all Web Push needs. */
function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Buffer {
  const prk = hmac(salt, ikm);
  return hmac(prk, info, Buffer.from([1])).subarray(0, length);
}

/** Record size written in the header; one record is plenty for a ≤ 4 KB payload. */
const RECORD_SIZE = 4096;
/** Push services accept 4096 bytes of body; header (86) + tag (16) + delimiter (1) leave this. */
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - 86 - 16 - 1;

export type EncryptOptions = {
  /** Test hooks: fix the random salt and the server's one-off key pair. */
  salt?: Uint8Array;
  serverPrivateKey?: Uint8Array;
};

/**
 * Encrypt `plaintext` for one subscription (RFC 8291 §3–4). Returns the full
 * request body: header (salt, record size, server public key) + ciphertext.
 */
export function encryptPayload(
  plaintext: Uint8Array,
  sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  opts: EncryptOptions = {},
): Buffer {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("Push payload too large");
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Invalid p256dh key");
  if (authSecret.length < 16) throw new Error("Invalid auth secret");

  // A fresh key pair per message: the server never reuses a shared secret.
  const ecdh = createECDH("prime256v1");
  if (opts.serverPrivateKey) ecdh.setPrivateKey(Buffer.from(opts.serverPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = Buffer.from(opts.salt ?? randomBytes(16));

  // Mix the auth secret and both public keys into the input keying material.
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Single (last) record: data, then the 0x02 "last record" padding delimiter.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ciphertext]);
}

/** A P-256 private key object built from the raw base64url keys browsers use. */
function vapidPrivateKey(keys: Pick<VapidKeys, "publicKey" | "privateKey">) {
  const pub = fromB64url(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID public key must be 65 bytes");
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: keys.privateKey,
    },
  });
}

/** True when the key pair parses and its halves belong together. */
export function vapidKeysValid(keys: Pick<VapidKeys, "publicKey" | "privateKey">): boolean {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(fromB64url(keys.privateKey));
    return ecdh.getPublicKey().equals(fromB64url(keys.publicKey)) && !!vapidPrivateKey(keys);
  } catch {
    return false;
  }
}

/**
 * The `Authorization` header for one push request (RFC 8292 §2–3): a JWT for
 * the push service's origin, valid for `ttlSeconds` (max 24 h), signed ES256.
 */
export function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 12 * 3600,
): string {
  const enc = (o: object) => b64url(Buffer.from(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({
    aud: new URL(endpoint).origin,
    exp: nowSeconds + ttlSeconds,
    sub: keys.subject,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: vapidPrivateKey(keys),
    dsaEncoding: "ieee-p1363", // JWS wants raw r||s, not DER
  });
  return `vapid t=${unsigned}.${b64url(signature)}, k=${keys.publicKey}`;
}

/** Generate a fresh VAPID key pair (also used by `scripts/vapid-keys.mjs`). */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

export type PushResult =
  | { ok: true }
  /** The browser unsubscribed or the subscription expired: delete it. */
  | { ok: false; gone: true; status: number | null }
  | { ok: false; gone: false; status: number | null; error?: string };

/** What a push service's HTTP status means for the stored subscription. */
export function classifyPushStatus(status: number): PushResult {
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 404 || status === 410) return { ok: false, gone: true, status };
  return { ok: false, gone: false, status };
}

export type SendOptions = {
  /** Seconds the push service keeps the message while the phone is offline. */
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Abort a slow push service after this long (never hold up the caller). */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** Encrypt and deliver one message. Never throws: failures come back as a result. */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  vapid: VapidKeys,
  opts: SendOptions,
): Promise<PushResult> {
  // Not a known push service: treat like an expired subscription so it is deleted.
  if (!isAllowedPushEndpoint(sub.endpoint)) return { ok: false, gone: true, status: null };
  try {
    const body = encryptPayload(Buffer.from(payload, "utf8"), sub);
    const res = await (opts.fetchImpl ?? fetch)(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(sub.endpoint, vapid),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(Math.max(0, Math.round(opts.ttl))),
        Urgency: opts.urgency ?? "normal",
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    return classifyPushStatus(res.status);
  } catch (err) {
    return { ok: false, gone: false, status: null, error: (err as Error).message };
  }
}

/**
 * Run `task` over `items` with at most `limit` in flight at once — a bounded
 * worker pool (a counting semaphore of `limit` slots), so a campus-wide alert
 * to thousands of phones never opens thousands of sockets at the same moment.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
