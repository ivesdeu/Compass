import type { SupabaseClient } from "npm:@supabase/supabase-js@2.101.1";

/**
 * Google/Microsoft often omit `refresh_token` on repeat consent. Keep the previous DB value when the new exchange has none.
 */
export async function resolveRefreshTokenForUpsert(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  provider: "google" | "microsoft",
  newEncryptedRefresh: string | null,
): Promise<string | null> {
  if (newEncryptedRefresh) return newEncryptedRefresh;
  const { data } = await admin
    .from("integration_credentials")
    .select("refresh_token")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  const row = data as { refresh_token?: string | null } | null;
  return row?.refresh_token ?? null;
}
