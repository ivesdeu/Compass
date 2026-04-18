/**
 * Signed OAuth state for Google/Microsoft browser redirects (callback has no Supabase JWT).
 * Set OAUTH_STATE_SECRET (32+ random bytes as string) via `supabase secrets set`.
 */
import { decodeBase64Url, encodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

function enc() {
  return new TextEncoder();
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc().encode(secret));
  return await crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hmacSha256B64Url(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc().encode(message));
  return encodeBase64Url(new Uint8Array(sig));
}

export type OAuthStatePayload = {
  /** Supabase auth user id */
  u: string;
  /** organization uuid */
  o: string;
  /** unix seconds expiry */
  e: number;
  /** random nonce */
  n: string;
  /** Which OAuth flow produced this state (callbacks must match). */
  p: "google" | "microsoft";
  /** Safe same-site return path (leading slash, no protocol). */
  r?: string;
};

export async function signOAuthState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const body = JSON.stringify(payload);
  const sig = await hmacSha256B64Url(secret, body);
  return encodeBase64Url(enc().encode(body)) + "." + sig;
}

export async function verifyOAuthState(state: string, secret: string): Promise<OAuthStatePayload | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  try {
    const bodyBytes = decodeBase64Url(parts[0]);
    const body = new TextDecoder().decode(bodyBytes);
    const expected = await hmacSha256B64Url(secret, body);
    if (expected !== parts[1]) return null;
    const parsed = JSON.parse(body) as OAuthStatePayload;
    if (!parsed || typeof parsed.u !== "string" || typeof parsed.o !== "string") return null;
    if (parsed.p !== "google" && parsed.p !== "microsoft") return null;
    if (typeof parsed.e !== "number" || parsed.e < Date.now() / 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function randomNonce(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return encodeBase64Url(a);
}
