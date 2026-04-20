import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.101.1";
import { serveWithEdgeRequestLogging } from "../_shared/withEdgeRequestLogging.ts";
import Stripe from "npm:stripe@16.12.0";
import { edgeLog } from "../_shared/edgeLog.ts";

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function connectStatusFromAccount(acct: Stripe.Account): string {
  if (acct.charges_enabled && acct.payouts_enabled) return "active";
  if (!acct.details_submitted) return "pending";
  return "restricted";
}

async function orgOwnerUserId(admin: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data: owner } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (owner?.user_id) return String(owner.user_id);
  const { data: anyMem } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
  return anyMem?.user_id ? String(anyMem.user_id) : null;
}

async function mergeTransactionStripeMetadata(
  admin: SupabaseClient,
  params: { txId: string; organizationId: string; pi: Stripe.PaymentIntent },
): Promise<void> {
  const { data: txRow, error: fetchErr } = await admin
    .from("transactions")
    .select("metadata")
    .eq("id", params.txId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();
  if (fetchErr || !txRow) return;

  const rawMeta = txRow.metadata as unknown;
  let prev: Record<string, unknown> = {};
  if (rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)) {
    prev = { ...(rawMeta as Record<string, unknown>) };
  } else if (typeof rawMeta === "string") {
    try {
      const parsed = JSON.parse(rawMeta) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        prev = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      prev = {};
    }
  }
  const chargeId =
    typeof params.pi.latest_charge === "string"
      ? params.pi.latest_charge
      : (params.pi.latest_charge as Stripe.Charge | null)?.id;
  const next: Record<string, unknown> = {
    ...prev,
    income_source: "stripe",
    stripe_payment_intent_id: params.pi.id,
  };
  if (chargeId) next.stripe_charge_id = chargeId;

  await admin
    .from("transactions")
    .update({ metadata: next })
    .eq("id", params.txId)
    .eq("organization_id", params.organizationId);
}

async function resolveOrganizationIdFromPaymentIntent(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventAccount: string | null,
): Promise<string> {
  const fromMeta = String(pi.metadata?.organization_id || "").trim();
  if (fromMeta) return fromMeta;
  if (eventAccount) {
    const { data } = await admin
      .from("organization_stripe_connections")
      .select("organization_id")
      .eq("stripe_account_id", eventAccount)
      .maybeSingle();
    if (data?.organization_id) return String(data.organization_id);
  }
  return "";
}

serveWithEdgeRequestLogging("stripe-webhook", async (req, ctx) => {
  const requestId = ctx.requestId;
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !stripeWebhookSecret) {
    return json(500, {
      error:
        "Missing env vars. Expected SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.",
    });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "Missing stripe-signature header." });

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey, { appInfo: { name: "idm-business-dashboard", version: "1.0.0" } });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    const details = err instanceof Error ? err.message : "Invalid signature";
    return json(400, { error: "Webhook signature verification failed.", details });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const eventAccount = typeof event.account === "string" ? event.account : null;

  try {
    if (event.type === "account.updated") {
      const acct = event.data.object as Stripe.Account;
      const connect_status = connectStatusFromAccount(acct);
      const { error } = await admin
        .from("organization_stripe_connections")
        .update({
          charges_enabled: !!acct.charges_enabled,
          payouts_enabled: !!acct.payouts_enabled,
          details_submitted: !!acct.details_submitted,
          livemode: !!acct.livemode,
          connect_status,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", acct.id);

      if (error) {
        edgeLog({
          fn: "stripe-webhook",
          level: "warn",
          action: "ignore",
          requestId,
          detail: `account.updated: ${error.message}`,
        });
      }
      return json(200, { ok: true, event: event.type });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id;
      if (!invoiceId) return json(200, { ok: true, event: event.type, ignored: "No invoice_id metadata." });

      const orgId = String(session.metadata?.organization_id || "").trim();
      if (!orgId) {
        return json(200, {
          ok: true,
          event: event.type,
          ignored: "Missing organization_id metadata; invoice not updated.",
        });
      }

      const { data: invRow, error: invFetchErr } = await admin
        .from("invoices")
        .select("id, organization_id, income_tx_id")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invFetchErr) {
        return json(500, { error: "Failed to load invoice.", details: invFetchErr.message });
      }
      if (!invRow) {
        return json(200, { ok: true, event: event.type, ignored: "Invoice not found." });
      }
      if (String((invRow as { organization_id?: string }).organization_id || "") !== orgId) {
        edgeLog({
          fn: "stripe-webhook",
          level: "warn",
          action: "ignore",
          requestId,
          organizationId: orgId,
          detail: "checkout.session.completed org metadata mismatch with invoice row",
        });
        return json(200, {
          ok: true,
          event: event.type,
          ignored: "organization_id metadata does not match invoice.",
        });
      }

      const paidAtIso = new Date().toISOString();
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id || null;

      const { error } = await admin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: paidAtIso,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntent,
          stripe_customer_id: customerId,
          stripe_status: session.payment_status || "paid",
        })
        .eq("id", invoiceId)
        .eq("organization_id", orgId);

      if (error) {
        return json(500, { error: "Failed to update invoice.", details: error.message });
      }

      const incomeTxId = String((invRow as { income_tx_id?: string }).income_tx_id || "").trim();
      if (incomeTxId && paymentIntent) {
        try {
          const pi = eventAccount
            ? await stripe.paymentIntents.retrieve(paymentIntent, { stripeAccount: eventAccount })
            : await stripe.paymentIntents.retrieve(paymentIntent);
          await mergeTransactionStripeMetadata(admin, {
            txId: incomeTxId,
            organizationId: orgId,
            pi,
          });
        } catch (e) {
          edgeLog({
            fn: "stripe-webhook",
            level: "warn",
            action: "ignore",
            requestId,
            detail: `checkout.session.completed pi merge: ${e instanceof Error ? e.message : "failed"}`,
          });
        }
      }

      return json(200, { ok: true, event: event.type });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id;
      if (invoiceId) {
        const orgId = String(session.metadata?.organization_id || "").trim();
        if (!orgId) {
          return json(200, {
            ok: true,
            event: event.type,
            ignored: "Missing organization_id metadata; invoice not updated.",
          });
        }

        const { data: invRow } = await admin
          .from("invoices")
          .select("id, organization_id")
          .eq("id", invoiceId)
          .maybeSingle();
        if (!invRow || String((invRow as { organization_id?: string }).organization_id || "") !== orgId) {
          edgeLog({
            fn: "stripe-webhook",
            level: "warn",
            action: "ignore",
            requestId,
            organizationId: orgId || undefined,
            detail: "checkout.session.expired org mismatch or invoice not found",
          });
          return json(200, {
            ok: true,
            event: event.type,
            ignored: "organization_id mismatch or invoice not found.",
          });
        }

        await admin
          .from("invoices")
          .update({
            stripe_checkout_session_id: session.id,
            stripe_status: "expired",
          })
          .eq("id", invoiceId)
          .eq("organization_id", orgId);
      }
      return json(200, { ok: true, event: event.type });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orgId = await resolveOrganizationIdFromPaymentIntent(admin, pi, eventAccount);
      if (!orgId) {
        return json(200, {
          ok: true,
          event: event.type,
          ignored: "Could not resolve organization_id for payment intent.",
        });
      }

      const invoiceId = String(pi.metadata?.invoice_id || "").trim();
      const incomeFromMeta = String(pi.metadata?.income_tx_id || "").trim();

      if (invoiceId) {
        const { data: inv, error: invErr } = await admin
          .from("invoices")
          .select("id, organization_id, income_tx_id, status")
          .eq("id", invoiceId)
          .maybeSingle();

        if (invErr || !inv) {
          return json(200, { ok: true, event: event.type, ignored: "Invoice not found for payment intent." });
        }
        if (String((inv as { organization_id?: string }).organization_id || "") !== orgId) {
          return json(200, { ok: true, event: event.type, ignored: "Invoice organization mismatch." });
        }

        const invIncome = String((inv as { income_tx_id?: string }).income_tx_id || "").trim();
        const txId = invIncome || incomeFromMeta;
        if (txId) {
          await mergeTransactionStripeMetadata(admin, { txId, organizationId: orgId, pi });
        }

        if ((inv as { status?: string }).status !== "paid") {
          const paidAtIso = new Date().toISOString();
          const customerId =
            typeof pi.customer === "string" ? pi.customer : (pi.customer as Stripe.Customer | null)?.id || null;
          await admin
            .from("invoices")
            .update({
              status: "paid",
              paid_at: paidAtIso,
              stripe_payment_intent_id: pi.id,
              stripe_customer_id: customerId,
              stripe_status: "succeeded",
            })
            .eq("id", invoiceId)
            .eq("organization_id", orgId);
        }

        return json(200, { ok: true, event: event.type });
      }

      // Standalone Connect charge (no dashboard invoice): idempotent insert.
      const userId = await orgOwnerUserId(admin, orgId);
      if (!userId) {
        return json(200, { ok: true, event: event.type, ignored: "No organization member for user_id." });
      }

      const amount = (pi.amount_received ?? pi.amount ?? 0) / 100;
      const date = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10);
      const chargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge as Stripe.Charge | null)?.id || null;

      const metadata: Record<string, unknown> = {
        income_source: "stripe",
        stripe_payment_intent_id: pi.id,
      };
      if (chargeId) metadata.stripe_charge_id = chargeId;

      const { error: insErr } = await admin.from("transactions").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        organization_id: orgId,
        date,
        category: "svc",
        amount,
        description: pi.description || "Stripe payment",
        source: "Stripe",
        metadata,
      });

      if (insErr) {
        const code = (insErr as { code?: string }).code;
        if (code === "23505" || /duplicate|unique/i.test(insErr.message)) {
          return json(200, { ok: true, event: event.type, deduped: true });
        }
        return json(500, { error: "Failed to insert Stripe income transaction.", details: insErr.message });
      }

      return json(200, { ok: true, event: event.type });
    }

    return json(200, { ok: true, event: event.type });
  } catch (err) {
    const details = err instanceof Error ? err.message : "Unhandled webhook error";
    return json(500, { error: "Webhook handler failed.", details });
  }
});
