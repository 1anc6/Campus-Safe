import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import { describe, it } from "node:test";
import {
  b64url,
  classifyPushStatus,
  encryptPayload,
  fromB64url,
  generateVapidKeys,
  isAllowedPushEndpoint,
  mapWithLimit,
  MAX_PLAINTEXT_BYTES,
  sendWebPush,
  vapidAuthorization,
  vapidKeysValid,
} from "./web-push.ts";

// RFC 8291, Section 5 and Appendix A: the worked encryption example.
const RFC = {
  plaintext: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** The browser's side of RFC 8291, written independently, to round-trip random messages. */
function decrypt(body: Buffer, uaPrivate: Buffer, auth: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const uaPublic = ecdh.getPublicKey();
  const h = (k: Buffer, ...d: Buffer[]) => {
    const m = createHmac("sha256", k);
    d.forEach((x) => m.update(x));
    return m.digest();
  };
  const one = Buffer.from([1]);
  const ikm = h(
    h(auth, ecdh.computeSecret(asPublic)),
    Buffer.from("WebPush: info\0"),
    uaPublic,
    asPublic,
    one,
  );
  const prk = h(salt, ikm);
  const cek = h(prk, Buffer.from("Content-Encoding: aes128gcm\0"), one).subarray(0, 16);
  const nonce = h(prk, Buffer.from("Content-Encoding: nonce\0"), one).subarray(0, 12);
  const ct = body.subarray(21 + idlen);
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const padded = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  const end = padded.lastIndexOf(2);
  return padded.subarray(0, end);
}

describe("encryptPayload (RFC 8291 aes128gcm)", () => {
  it("reproduces the RFC 8291 worked example byte for byte", () => {
    const body = encryptPayload(
      fromB64url(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: fromB64url(RFC.salt), serverPrivateKey: fromB64url(RFC.asPrivate) },
    );
    assert.equal(b64url(body), RFC.body);
  });

  it("round-trips a fresh message that only the subscribed browser can read", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = Buffer.alloc(16, 7);
    const msg = JSON.stringify({ title: "SOS assigned to you", url: "/staff/abc" });
    const sub = { p256dh: b64url(ua.getPublicKey()), auth: b64url(auth) };
    const a = encryptPayload(Buffer.from(msg), sub);
    const b = encryptPayload(Buffer.from(msg), sub);
    assert.equal(decrypt(a, ua.getPrivateKey(), auth).toString(), msg);
    // New salt and server key every time: the same text never encrypts the same way.
    assert.notDeepEqual(a, b);
  });

  it("rejects payloads that cannot fit in one push message", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const sub = { p256dh: b64url(ua.getPublicKey()), auth: b64url(Buffer.alloc(16)) };
    assert.doesNotThrow(() => encryptPayload(Buffer.alloc(MAX_PLAINTEXT_BYTES), sub));
    assert.throws(() => encryptPayload(Buffer.alloc(MAX_PLAINTEXT_BYTES + 1), sub), /too large/);
  });

  it("rejects malformed browser keys", () => {
    assert.throws(() => encryptPayload(Buffer.from("x"), { p256dh: "AAAA", auth: RFC.auth }));
  });
});

describe("VAPID", () => {
  const keys = { ...generateVapidKeys(), subject: "mailto:security@campus.test" };

  it("signs an ES256 JWT for the push service origin that verifies with the public key", () => {
    const now = 1_800_000_000;
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, now);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    assert.ok(m, header);
    const [, h, p, s, k] = m;
    assert.equal(k, keys.publicKey);
    assert.deepEqual(JSON.parse(fromB64url(h).toString()), { typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(fromB64url(p).toString());
    assert.equal(claims.aud, "https://fcm.googleapis.com");
    assert.equal(claims.sub, keys.subject);
    assert.equal(claims.exp, now + 12 * 3600);
    const pub = fromB64url(keys.publicKey);
    const key = createPublicKey({
      format: "jwk",
      key: { kty: "EC", crv: "P-256", x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33)) },
    });
    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key, dsaEncoding: "ieee-p1363" },
      fromB64url(s),
    );
    assert.equal(ok, true);
  });

  it("checks that the two halves of a key pair belong together", () => {
    assert.equal(vapidKeysValid(keys), true);
    assert.equal(vapidKeysValid({ ...keys, privateKey: generateVapidKeys().privateKey }), false);
    assert.equal(vapidKeysValid({ publicKey: "nope", privateKey: "nope" }), false);
  });
});

describe("isAllowedPushEndpoint", () => {
  it("accepts the real browser push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QAbc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), true, url);
    }
  });

  it("refuses anything that would let a caller aim the server at another host", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://localhost/push",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.evil.test/x",
      "https://evilfcm.googleapis.com.test/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "not a url",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), false, url);
    }
  });
});

describe("classifyPushStatus", () => {
  it("deletes only subscriptions the push service says are gone", () => {
    assert.deepEqual(classifyPushStatus(201), { ok: true });
    assert.deepEqual(classifyPushStatus(404), { ok: false, gone: true, status: 404 });
    assert.deepEqual(classifyPushStatus(410), { ok: false, gone: true, status: 410 });
    assert.deepEqual(classifyPushStatus(429), { ok: false, gone: false, status: 429 });
    assert.deepEqual(classifyPushStatus(500), { ok: false, gone: false, status: 500 });
  });
});

describe("sendWebPush", () => {
  const vapid = { ...generateVapidKeys(), subject: "mailto:security@campus.test" };
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: b64url(ua.getPublicKey()),
    auth: b64url(Buffer.alloc(16, 1)),
  };

  it("posts an encrypted body with the Web Push headers", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const res = await sendWebPush(sub, '{"title":"t"}', vapid, {
      ttl: 60,
      urgency: "high",
      fetchImpl,
    });
    assert.deepEqual(res, { ok: true });
    assert.ok(seen);
    const { url, init } = seen as { url: string; init: RequestInit };
    assert.equal(url, sub.endpoint);
    const headers = init.headers as Record<string, string>;
    assert.equal(headers["Content-Encoding"], "aes128gcm");
    assert.equal(headers.TTL, "60");
    assert.equal(headers.Urgency, "high");
    assert.match(headers.Authorization, /^vapid t=/);
    const body = Buffer.from(init.body as Uint8Array);
    assert.equal(
      decrypt(body, ua.getPrivateKey(), Buffer.alloc(16, 1)).toString(),
      '{"title":"t"}',
    );
  });

  it("reports network failures instead of throwing", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const res = await sendWebPush(sub, "{}", vapid, { ttl: 60, fetchImpl });
    assert.deepEqual(res, { ok: false, gone: false, status: null, error: "ECONNRESET" });
  });

  it("never contacts a host outside the push-service list", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const res = await sendWebPush({ ...sub, endpoint: "https://example.test/x" }, "{}", vapid, {
      ttl: 60,
      fetchImpl,
    });
    assert.equal(called, false);
    assert.equal(res.ok, false);
  });
});

describe("mapWithLimit", () => {
  it("keeps order and never runs more than `limit` tasks at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithLimit([5, 1, 4, 2, 3, 0, 6], 3, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running -= 1;
      return n * 2;
    });
    assert.deepEqual(out, [10, 2, 8, 4, 6, 0, 12]);
    assert.equal(peak, 3);
  });

  it("handles an empty list", async () => {
    assert.deepEqual(await mapWithLimit([], 4, async () => 1), []);
  });
});
