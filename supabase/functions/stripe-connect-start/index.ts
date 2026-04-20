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

serveWithEdgeRequestLogging("stripe-connect-start", async (req, ctx) => {
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
  const appBase = (Deno.env.get("APP_BASE_URL") || "http://localhost:5173").replace(/\/$/, "");
  const defaultCountry = (Deno.env.get("STRIPE_CONNECT_DEFAULT_COUNTRY") || "US").trim().toUpperCase();

  if (!supabaseUrl || !anonKey || !serviceKey || !stripeSecret) {
    return json(req, 500, { error: "Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or STRIPE_SECRET_KEY." });
  }

  const authHeader = req.headers.get("Authorization")?.trim() || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(req, 401, { error: "Missing Authorization bearer token." });
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return json(req, 401, { error: "Missing JWT." });

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
    return json(req, 403, { error: "Only workspace owners and admins can connect Stripe." });
  }

  const { data: row, error: rowErr } = await admin
    .from("organization_stripe_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (rowErr) {
    return json(req, 500, { error: "Failed to load Stripe connection.", details: rowErr.message });
  }

  let stripeAccountId = row?.stripe_account_id as string | undefined;

  if (!stripeAccountId) {
    let livemode = false;
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: defaultCountry.length === 2 ? defaultCountry : "US",
        email: user.email || undefined,
        metadata: { organization_id: organizationId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;
      livemode = !!account.livemode;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe account create failed";
      edgeLog({
        fn: "stripe-connect-start",
        level: "error",
        action: "deny",
        requestId,
        detail: `accounts.create: ${msg}`,
      });
      return json(req, 500, { error: "Could not create Stripe Connect account.", details: msg });
    }

    const { error: insErr } = await admin.from("organization_stripe_connections").upsert(
      {
        organization_id: organizationId,
        stripe_account_id: stripeAccountId,
        connect_status: "pending",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        livemode,
        updated_at: new Date().toISOString(),
        onboarded_by_user_id: user.id,
      },
      { onConflict: "organization_id" },
    );

    if (insErr) {
      return json(req, 500, { error: "Failed to save Stripe connection row.", details: insErr.message });
    }
  }

  const refreshUrl = `${appBase}/?settings=1&stripe_panel=stripe&stripe_refresh=1`;
  const returnUrl = `${appBase}/?settings=1&stripe_panel=stripe&stripe_return=1`;

  try {
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    edgeLog({
      fn: "stripe-connect-start",
      level: "info",
      action: "allow",
      requestId,
      organizationId,
      detail: "account_link created",
    });

    return json(req, 200, {
      url: link.url,
      stripeAccountId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "accountLinks.create failed";
    edgeLog({
      fn: "stripe-connect-start",
      level: "error",
      action: "deny",
      requestId,
      organizationId,
      detail: `accountLinks.create: ${msg}`,
    });
    return json(req, 500, { error: "Could not start Stripe onboarding.", details: msg });
  }
});
