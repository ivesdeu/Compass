/**
 * Structured JSON logs for Edge Functions (Supabase / Deno).
 * Safe for log drains: do not pass PII bodies, tokens, or full payment payloads.
 */
export type EdgeLogAction = "allow" | "deny" | "ignore";
export type EdgeLogLevel = "info" | "warn" | "error";

export type EdgeLogEvent = {
  fn: string;
  level: EdgeLogLevel;
  action: EdgeLogAction;
  userId?: string;
  organizationId?: string;
  /** Per-request id from `serveWithEdgeRequestLogging`; pass through on deny/ignore paths. */
  requestId?: string;
  detail?: string;
};

export function edgeLog(event: EdgeLogEvent): void {
  const line = JSON.stringify({
    ...event,
    ts: new Date().toISOString(),
  });
  if (event.level === "error") {
    console.error(line);
  } else if (event.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
