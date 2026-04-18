import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { edgeFunctionUrl } from "../_shared/edgeUrls.ts";
import { resolveOrganizationId } from "../_shared/orgContext.ts";
import { randomNonce, signOAuthState } from "../_shared/oauthState.ts";
import { sanitizeReturnPath } from "../_shared/returnPath.ts";

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

const DEFAULT_MS_SCOPES = "openid offline_access User.Read";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return json(req, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  if (!supabaseUrl || !anonKey || !stateSecret || !clientId) {
    return json(req, 500, { error: "Missing Supabase or Microsoft OAuth configuration" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, 401, { error: "Missing Authorization" });
  }

  let organizationId: string | undefined;
  let returnPath: string | undefined;
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { organization_id?: string; return_path?: string };
      organizationId = body.organization_id?.trim();
      returnPath = body.return_path;
    } catch {
      return json(req, 400, { error: "Invalid JSON" });
    }
  }

  const jwt = authHeader.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user?.id) {
    return json(req, 401, { error: "Invalid session" });
  }
  const user = userData.user;

  const orgId = await resolveOrganizationId(userClient, user.id, organizationId ?? null);
  if (!orgId) {
    return json(req, 403, { error: "No organization membership for this account" });
  }

  const tenant = (Deno.env.get("MICROSOFT_TENANT_ID")?.trim() || "common");
  const redirectOverride = Deno.env.get("MICROSOFT_REDIRECT_URI")?.trim();
  const redirectUri = redirectOverride || edgeFunctionUrl(supabaseUrl, "oauth-microsoft-callback");
  const scopes = (Deno.env.get("MICROSOFT_OAUTH_SCOPES")?.trim() || DEFAULT_MS_SCOPES).replace(/\s+/g, " ");
  const now = Math.floor(Date.now() / 1000);
  const state = await signOAuthState(
    {
      u: user.id,
      o: orgId,
      e: now + 600,
      n: randomNonce(),
      p: "microsoft",
      r: sanitizeReturnPath(returnPath),
    },
    stateSecret,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: scopes,
    state,
  });
  const authorize = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  return json(req, 200, { url: authorize, redirect_uri: redirectUri, tenant });
});
