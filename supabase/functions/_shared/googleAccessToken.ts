import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { maybeDecryptRefreshToken, maybeEncryptRefreshToken } from "./tokenCrypto.ts";
import { resolveRefreshTokenForUpsert } from "./mergeRefreshToken.ts";

const SKEW_MS = 90_000;

export type GoogleAccessResult =
  | { ok: true; accessToken: string }
  | { ok: false; code: "not_connected" | "refresh_failed" | "token_exchange" };

type CredRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  provider_account_id: string | null;
  raw_token: Record<string, unknown> | null;
};

function isExpired(expiresAtIso: string | null): boolean {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return true;
  return Date.now() + SKEW_MS >= t;
}

/**
 * Returns a valid Google OAuth access token for the user's Google integration in this org.
 * Refreshes using refresh_token when expired and persists new tokens via service_role.
 */
export async function getGoogleAccessTokenForUserOrg(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleAccessResult> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select(
      "access_token, refresh_token, token_expires_at, scopes, provider_account_id, raw_token",
    )
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, code: "not_connected" };
  }

  const row = data as CredRow;
  const accessToken = row.access_token ? String(row.access_token).trim() : "";
  const expiresAt = row.token_expires_at;

  if (accessToken && !isExpired(expiresAt)) {
    return { ok: true, accessToken };
  }

  const plainRefresh = await maybeDecryptRefreshToken(
    row.refresh_token != null ? String(row.refresh_token) : null,
  );
  if (!plainRefresh) {
    return { ok: false, code: "refresh_failed" };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: plainRefresh,
    }).toString(),
  });

  const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
  if (!tokenRes.ok) {
    return { ok: false, code: "token_exchange" };
  }

  const newAccess = String(tokenJson.access_token || "");
  if (!newAccess) {
    return { ok: false, code: "token_exchange" };
  }

  const newRefresh = tokenJson.refresh_token != null ? String(tokenJson.refresh_token) : null;
  const expiresIn =
    typeof tokenJson.expires_in === "number"
      ? tokenJson.expires_in
      : Number(tokenJson.expires_in);
  const tokenExpiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

  const encRefresh = await maybeEncryptRefreshToken(newRefresh);
  const refreshOut = await resolveRefreshTokenForUpsert(
    admin,
    organizationId,
    userId,
    "google",
    encRefresh,
  );

  const scopeStr = String(tokenJson.scope || row.scopes || "");
  const { error: upErr } = await admin.from("integration_credentials").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      provider: "google",
      access_token: newAccess,
      refresh_token: refreshOut,
      token_expires_at: tokenExpiresAt,
      scopes: scopeStr || row.scopes,
      provider_account_id: row.provider_account_id,
      raw_token: row.raw_token ?? { scope: scopeStr },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id,provider" },
  );

  if (upErr) {
    return { ok: false, code: "token_exchange" };
  }

  return { ok: true, accessToken: newAccess };
}
