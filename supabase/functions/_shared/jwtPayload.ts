import { decodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

/** Decode JWT payload (middle segment) without signature verification — OK for non-security claims like `sub`. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const bytes = decodeBase64Url(parts[1]);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
