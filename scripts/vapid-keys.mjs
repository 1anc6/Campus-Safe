// @ts-check
/**
 * Print a fresh VAPID key pair for phone push notifications:
 *
 *   node scripts/vapid-keys.mjs
 *
 * Paste the output into your host's environment variables (on Vercel:
 * Project → Settings → Environment Variables) and redeploy. Generate one pair
 * per deployment and keep the private key secret; changing it later means every
 * device has to turn notifications on again (the app does this quietly on the
 * next visit where permission was already granted).
 */
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`);
console.log("VAPID_SUBJECT=mailto:you@yourcollege.ac.in");
