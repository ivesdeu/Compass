import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function resolveOrganizationId(
  userClient: SupabaseClient,
  userId: string,
  requestedOrgId?: string | null,
): Promise<string | null> {
  if (requestedOrgId) {
    const { data, error } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", requestedOrgId)
      .maybeSingle();
    if (error || !data?.organization_id) return null;
    return String(data.organization_id);
  }
  const { data: rows, error } = await userClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !rows?.length) return null;
  return String(rows[0].organization_id);
}
