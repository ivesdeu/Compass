import { decodeBase64Url, encodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

const PREFIX = "enc:v1:";

function enc() {
  return new TextEncoder();
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc().encode(secret));
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** When `INTEGRATION_TOKEN_ENCRYPTION_KEY` is unset, values pass through unchanged. */
export async function maybeEncryptRefreshToken(plain: string | null): Promise<string | null> {
  if (plain == null) return null;
  const secret = Deno.env.get("INTEGRATION_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!secret) return plain;

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await importAesKey(secret);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc().encode(plain)),
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return PREFIX + encodeBase64Url(combined);
}

export async function maybeDecryptRefreshToken(stored: string | null): Promise<string | null> {
  if (stored == null) return null;
  const secret = Deno.env.get("INTEGRATION_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!secret || !stored.startsWith(PREFIX)) return stored;

  const key = await importAesKey(secret);
  const raw = decodeBase64Url(stored.slice(PREFIX.length));
  if (raw.length < 13) return null;
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
