/** SPA serves all routes via index.html; root preserves org slug paths when callers pass return_path. */
const DEFAULT_PATH = "/";

/** Same-origin relative path only — avoids open redirects after OAuth. */
export function sanitizeReturnPath(input: string | undefined | null): string {
  if (input == null || typeof input !== "string") return DEFAULT_PATH;
  const t = input.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return DEFAULT_PATH;
  if (t.length > 2048) return DEFAULT_PATH;
  return t;
}

export function successRedirectUrl(
  appSiteUrl: string,
  returnPath: string,
  query: Record<string, string>,
): string {
  const base = appSiteUrl.replace(/\/$/, "");
  const path = sanitizeReturnPath(returnPath);
  const q = new URLSearchParams(query);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return `${base}${path}${suffix}`;
}
