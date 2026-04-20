import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { edgeLog } from "./edgeLog.ts";

export type EdgeRequestCtx = { requestId: string };

function withRequestIdHeader(res: Response, requestId: string): Response {
  const headers = new Headers(res.headers);
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", requestId);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Wraps std/http `serve`: emits a structured start line, adds `x-request-id` on responses,
 * and maps uncaught errors to 500 + JSON (no stack in body).
 */
export function serveWithEdgeRequestLogging(
  fn: string,
  handler: (req: Request, ctx: EdgeRequestCtx) => Response | Promise<Response>,
): void {
  serve(async (req) => {
    const requestId = crypto.randomUUID();
    let path = "";
    try {
      path = new URL(req.url).pathname;
    } catch {
      path = "(bad-url)";
    }
    const routeHint = `${req.method} ${path}`.slice(0, 120);
    edgeLog({ fn, level: "info", action: "allow", requestId, detail: routeHint });
    try {
      const res = await handler(req, { requestId });
      return withRequestIdHeader(res, requestId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      edgeLog({
        fn,
        level: "error",
        action: "deny",
        requestId,
        detail: msg.slice(0, 300),
      });
      return new Response(JSON.stringify({ error: "Internal error", requestId }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
        },
      });
    }
  });
}
