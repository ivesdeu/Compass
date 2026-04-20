import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { serveWithEdgeRequestLogging } from "../_shared/withEdgeRequestLogging.ts";
import Stripe from "npm:stripe@16.12.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { edgeLog } from "../_shared/edgeLog.ts";

type Body = { organizationId?: string };

function json(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

function isAdminRole(role: string | undefined) {
  return role === "owner" || role === "admin";
}

serveWithEdgeRequestLogging("stripe-connect-disconnect", async (req, ctx) => {
  const requestId = ctx.requestId;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed. Use POST." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey || !stripeSecret) {
    return json(req, 500, { error: "Missing required environment variables." });
  }

  const authHeader = req.headers.get("Authorization")?.trim() || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(req, 401, { error: "Missing Authorization bearer token." });
  }
  const jwt = authHeader.slice(7).trim();

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(req, 400, { error: "Invalid JSON body." });
  }

  const organizationId = String(body.organizationId || "").trim();
  if (!organizationId) {
    return json(req, 400, { error: "organizationId is required." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);
  const stripe = new Stripe(stripeSecret, { appInfo: { name: "idm-business-dashboard", version: "1.0.0" } });

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json(req, 401, { error: "Invalid or expired auth token." });
  }
  const user = userData.user;

  const { data: membership, error: memErr } = await userClient
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr || !membership || !isAdminRole(membership.role as string | undefined)) {
    return json(req, 403, { error: "Only workspace owners and admins can disconnect Stripe." });
  }

  const { data: row } = await admin
    .from("organization_stripe_connections")
    .select("stripe_account_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const acct = row?.stripe_account_id as string | undefined;
  if (acct) {
    try {
      await stripe.accounts.del(acct);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      edgeLog({
        fn: "stripe-connect-disconnect",
        level: "warn",
        action: "ignore",
        requestId,
        organizationId,
        detail: "accounts.del: " + msg,
      });
      // Still remove local row so the app stops routing Checkout to a broken account.
    }
  }

  const { error: delErr } = await admin
    .from("organization_stripe_connections")
    .delete()
    .eq("organization_id", organizationId);

  if (delErr) {
    return json(req, 500, { error: "Failed to remove Stripe connection.", details: delErr.message });
  }

  edgeLog({
    fn: "stripe-connect-disconnect",
    level: "info",
    action: "allow",
    requestId,
    organizationId,
    detail: "removed",
  });
  return json(req, 200, { ok: true });
});
