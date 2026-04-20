import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { resolveOrganizationId } from "../_shared/orgContext.ts";
import { getGoogleAccessTokenForUserOrg } from "../_shared/googleAccessToken.ts";

const MAX_SUBJECT = 500;
const MAX_BODY = 256_000;
const MAX_TO = 320;

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

function singleLine(s: string): string {
  return s.replace(/\r?\n/g, " ").trim();
}

function isReasonableEmail(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > MAX_TO) return false;
  return /^[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+$/.test(t);
}

function buildRfc2822(params: { from: string; to: string; subject: string; body: string }): string {
  const subj = singleLine(params.subject).slice(0, MAX_SUBJECT);
  const lines = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.body,
  ];
  return lines.join("\r\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!supabaseUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    return json(req, 500, { error: "Server misconfiguration" });
  }

  const authHeader = req.headers.get("Authorization")?.trim() || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(req, 401, { error: "Missing Authorization" });
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return json(req, 401, { error: "Missing Authorization" });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, 400, { error: "Invalid JSON" });
  }

  const organizationIdRaw = body.organization_id != null ? String(body.organization_id).trim() : "";
  const to = body.to != null ? String(body.to).trim() : "";
  const subject = body.subject != null ? String(body.subject) : "";
  const textBody = body.body != null ? String(body.body) : "";

  if (!to || !isReasonableEmail(to)) {
    return json(req, 400, { error: "Invalid to address" });
  }
  if (!subject.trim()) {
    return json(req, 400, { error: "Subject is required" });
  }
  if (!textBody.trim()) {
    return json(req, 400, { error: "Body is required" });
  }
  if (subject.length > MAX_SUBJECT || textBody.length > MAX_BODY) {
    return json(req, 400, { error: "Subject or body too long" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user?.id) {
    return json(req, 401, { error: userErr?.message || "Invalid session" });
  }
  const userId = userData.user.id;

  const orgId = await resolveOrganizationId(
    userClient,
    userId,
    organizationIdRaw || null,
  );
  if (!orgId) {
    return json(req, 403, { error: "No organization membership" });
  }

  const tokenResult = await getGoogleAccessTokenForUserOrg(
    admin,
    userId,
    orgId,
    clientId,
    clientSecret,
  );

  if (!tokenResult.ok) {
    if (tokenResult.code === "not_connected") {
      return json(req, 400, { error: "not_connected", detail: "Connect Google in Settings → Mail & Calendar." });
    }
    return json(req, 502, {
      error: "token_refresh",
      detail: "Could not refresh Google access. Reconnect in Settings → Mail & Calendar.",
    });
  }

  const access = tokenResult.accessToken;
  const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!meRes.ok) {
    return json(req, 502, { error: "userinfo", detail: "Could not resolve sender email." });
  }
  const meJson = (await meRes.json()) as { email?: string };
  const fromEmail = meJson.email ? String(meJson.email).trim() : "";
  if (!fromEmail || !isReasonableEmail(fromEmail)) {
    return json(req, 502, { error: "userinfo", detail: "Missing sender email." });
  }

  const rfc = buildRfc2822({
    from: fromEmail,
    to,
    subject,
    body: textBody,
  });
  const raw = encodeBase64Url(new TextEncoder().encode(rfc));

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const sendJson = (await sendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!sendRes.ok) {
    const errObj = sendJson.error as { message?: string } | undefined;
    const msg = errObj?.message || JSON.stringify(sendJson).slice(0, 200);
    if (sendRes.status === 401 || sendRes.status === 403) {
      return json(req, 403, { error: "gmail_denied", detail: msg });
    }
    if (sendRes.status === 429) {
      return json(req, 429, { error: "rate_limited", detail: msg });
    }
    return json(req, 502, { error: "gmail_send_failed", detail: msg });
  }

  const id = sendJson.id != null ? String(sendJson.id) : "";
  const threadId = sendJson.threadId != null ? String(sendJson.threadId) : "";
  if (!id) {
    return json(req, 502, { error: "gmail_send_failed", detail: "Missing message id in response." });
  }

  return json(req, 200, { id, threadId });
});
