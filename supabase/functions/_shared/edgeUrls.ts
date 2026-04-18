/** Canonical invoke URL for an Edge Function (matches Supabase hosted paths). */
export function edgeFunctionUrl(supabaseUrl: string, functionName: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1/${functionName}`;
}
