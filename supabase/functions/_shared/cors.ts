/**
 * Browser CORS for the static dashboard.
 *
 * - Always allow localhost dev ports.
 * - Allow comma-separated extra origins via DASHBOARD_ALLOWED_ORIGINS (e.g. custom apex domain).
 * - Allow common managed HTTPS hosts (Netlify/Vercel/etc.) so previews work without secrets.
 *
 * Endpoints still require a valid Supabase JWT; this only fixes browser preflight (OPTIONS).
 */
function parseAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  set.add("http://localhost:5173");
  set.add("http://127.0.0.1:5173");
  set.add("http://localhost:4173");
  set.add("http://127.0.0.1:4173");
  const appBaseRaw = (Deno.env.get("APP_BASE_URL") ?? "").trim();
  const appSiteRaw = (Deno.env.get("APP_SITE_URL") ?? "").trim();
  for (const originLike of [appBaseRaw, appSiteRaw]) {
    if (!originLike) continue;
    try {
      const u = new URL(originLike);
      set.add(u.origin);
    } catch {
      // Keep backward compatibility when APP_* env vars are absent or malformed.
    }
  }
  const raw = Deno.env.get("DASHBOARD_ALLOWED_ORIGINS") ?? "";
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t) set.add(t);
  }
  return set;
}

/** True when Origin is a normal https dashboard host we expect in the wild. */
function isCommonManagedHttpsOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    return (
      h.endsWith(".netlify.app") ||
      h.endsWith(".vercel.app") ||
      h.endsWith(".cloudflarepages.dev") ||
      h.endsWith(".pages.dev") ||
      h.endsWith(".github.io") ||
      h.endsWith(".lovable.app")
    );
  } catch {
    return false;
  }
}

function shouldReflectOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = parseAllowedOrigins();
  const allowListHit = allowed.has(origin);
  const managedHit = isCommonManagedHttpsOrigin(origin);
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/507d12bf-babb-4204-8816-34a6e29c9b5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae8d26'},body:JSON.stringify({sessionId:'ae8d26',runId:'pre-fix',hypothesisId:'H1',location:'supabase/functions/_shared/cors.ts:shouldReflectOrigin:initial-check',message:'evaluating cors origin against allow rules',data:{origin,allowListHit,managedHit,allowCount:allowed.size},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (allowListHit) return true;
  if (managedHit) return true;
  try {
    const u = new URL(origin);
    const localhostHttp = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/507d12bf-babb-4204-8816-34a6e29c9b5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae8d26'},body:JSON.stringify({sessionId:'ae8d26',runId:'pre-fix',hypothesisId:'H4',location:'supabase/functions/_shared/cors.ts:shouldReflectOrigin:parsed-origin',message:'parsed origin protocol and host',data:{origin,protocol:u.protocol,hostname:u.hostname,localhostHttp},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (localhostHttp) {
      return true;
    }
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7914/ingest/507d12bf-babb-4204-8816-34a6e29c9b5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae8d26'},body:JSON.stringify({sessionId:'ae8d26',runId:'pre-fix',hypothesisId:'H5',location:'supabase/functions/_shared/cors.ts:shouldReflectOrigin:parse-error',message:'origin parsing failed in cors check',data:{origin},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return false;
  }
  return false;
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (origin && shouldReflectOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  // #region agent log
  fetch('http://127.0.0.1:7914/ingest/507d12bf-babb-4204-8816-34a6e29c9b5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae8d26'},body:JSON.stringify({sessionId:'ae8d26',runId:'pre-fix',hypothesisId:'H2',location:'supabase/functions/_shared/cors.ts:corsHeadersFor:final-headers',message:'cors headers computed for request',data:{origin:origin||'',reflectedOrigin:headers["Access-Control-Allow-Origin"]||'',hasVary:headers["Vary"]==="Origin"},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return headers;
}
