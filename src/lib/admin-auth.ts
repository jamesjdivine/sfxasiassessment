/**
 * Admin auth — single shared password, HMAC-signed cookie.
 *
 * Uses Web Crypto (crypto.subtle) so the same module works from both Edge
 * runtime (middleware.ts) and Node runtime (route handlers, server components).
 *
 * Cookie name: sfx_admin
 * Cookie value: base64url(payload).base64url(signature)
 *   payload = JSON-encoded { exp: number /* unix seconds *​/ , v: 1 }
 *   signature = HMAC-SHA256(payload, ADMIN_COOKIE_SECRET)
 */

export const COOKIE_NAME = "sfx_admin";
export const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AdminTokenPayload {
  /** Unix seconds at which the token expires. */
  exp: number;
  /** Schema version, in case we change the payload shape later. */
  v: 1;
}

function te(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function td(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    te(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function getSecret(): string {
  const s = process.env.ADMIN_COOKIE_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_COOKIE_SECRET must be set (min 16 chars).");
  }
  return s;
}

/** Mint a new signed admin token valid for COOKIE_TTL_SECONDS. */
export async function signAdminToken(): Promise<string> {
  const payload: AdminTokenPayload = {
    exp: Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS,
    v: 1,
  };
  const payloadBytes = te(JSON.stringify(payload));
  const key = await importHmacKey(getSecret());
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes as unknown as BufferSource)
  );
  return `${toBase64Url(payloadBytes)}.${toBase64Url(sigBytes)}`;
}

/** Verify a token; returns payload if valid, else null. */
export async function verifyAdminToken(token: string | undefined | null): Promise<AdminTokenPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = fromBase64Url(payloadB64);
    sigBytes = fromBase64Url(sigB64);
  } catch {
    return null;
  }
  let key: CryptoKey;
  try {
    key = await importHmacKey(getSecret());
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as unknown as BufferSource,
    payloadBytes as unknown as BufferSource
  );
  if (!ok) return null;
  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(td(payloadBytes)) as AdminTokenPayload;
  } catch {
    return null;
  }
  if (payload.v !== 1) return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

/** Constant-time string equality for password comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
