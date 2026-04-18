import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { edgeFunctionUrl } from "../_shared/edgeUrls.ts";
import { verifyOAuthState } from "../_shared/oauthState.ts";
import { resolveRefreshTokenForUpsert } from "../_shared/mergeRefreshToken.ts";
import { successRedirectUrl } from "../_shared/returnPath.ts";
import { maybeEncryptRefreshToken } from "../_shared/tokenCrypto.ts";

function redirect(req: Request, location: string, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: location, ...corsHeadersFor(req) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeadersFor(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
  const appSiteUrl = Deno.env.get("APP_SITE_URL")?.trim();
  const tenant = (Deno.env.get("MICROSOFT_TENANT_ID")?.trim() || "common");
  if (!supabaseUrl || !serviceKey || !stateSecret || !clientId || !clientSecret || !appSiteUrl) {
    return new Response("Server misconfiguration", { status: 500, headers: corsHeadersFor(req) });
  }

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const payload = state ? await verifyOAuthState(state, stateSecret) : null;

  const failPath = payload?.r;
  if (err) {
    const loc = successRedirectUrl(appSiteUrl, failPath ?? "/", {
      oauth: "error",
      provider: "microsoft",
      detail: err,
    });
    return redirect(req, loc);
  }
  if (!code || !payload || payload.p !== "microsoft") {
    const loc = successRedirectUrl(appSiteUrl, failPath ?? "/", {
      oauth: "error",
      provider: "microsoft",
      detail: "invalid_state",
    });
    return redirect(req, loc);
  }

  const redirectOverride = Deno.env.get("MICROSOFT_REDIRECT_URI")?.trim();
  const redirectUri = redirectOverride || edgeFunctionUrl(supabaseUrl, "oauth-microsoft-callback");

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokenJson = (await tokenRes.json()) as Record<string, unknown>;
  if (!tokenRes.ok) {
    const loc = successRedirectUrl(appSiteUrl, payload.r ?? "/", {
      oauth: "error",
      provider: "microsoft",
      detail: "token_exchange",
    });
    return redirect(req, loc);
  }

  const accessToken = String(tokenJson.access_token || "");
  const refreshToken = tokenJson.refresh_token != null ? String(tokenJson.refresh_token) : null;
  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : Number(tokenJson.expires_in);
  const scopeStr = String(tokenJson.scope || "");

  let providerAccountId = "";
  if (accessToken) {
    const me = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (me.ok) {
      const meJson = (await me.json()) as { id?: string };
      if (meJson.id) providerAccountId = String(meJson.id);
    }
  }

  const tokenExpiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

  const admin = createClient(supabaseUrl, serviceKey);
  const encRefresh = await maybeEncryptRefreshToken(refreshToken);
  const refreshOut = await resolveRefreshTokenForUpsert(admin, payload.o, payload.u, "microsoft", encRefresh);

  const { error: upErr } = await admin.from("integration_credentials").upsert(
    {
      organization_id: payload.o,
      user_id: payload.u,
      provider: "microsoft",
      access_token: accessToken,
      refresh_token: refreshOut,
      token_expires_at: tokenExpiresAt,
      scopes: scopeStr,
      provider_account_id: providerAccountId || null,
      raw_token: { token_type: tokenJson.token_type, scope: scopeStr, tenant },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id,provider" },
  );

  if (upErr) {
    const loc = successRedirectUrl(appSiteUrl, payload.r ?? "/", {
      oauth: "error",
      provider: "microsoft",
      detail: "db",
    });
    return redirect(req, loc);
  }

  const loc = successRedirectUrl(appSiteUrl, payload.r ?? "/", {
    oauth: "ok",
    provider: "microsoft",
  });
  return redirect(req, loc);
});
