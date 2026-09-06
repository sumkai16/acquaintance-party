import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await adminClient()
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, fullName: data.full_name, role: data.role };
}

/**
 * Every provisioned user's id -> full name, admin and staff alike. Used to
 * label "Added By" on a walk-in row and "User" on an activity log row,
 * where the acting account could be either role.
 */
export async function listAllProfileNames(): Promise<Map<string, string>> {
  const { data } = await adminClient().from("profiles").select("id, full_name");
  return new Map((data ?? []).map((row) => [row.id as string, row.full_name as string]));
}

/**
 * Every provisioned user, full profile — for the admin activity log's
 * User/Role columns and its account filter dropdown. Ordered admin-first
 * (alphabetically "admin" < "staff"), then by name within each role.
 */
export async function listAllProfiles(): Promise<Profile[]> {
  const { data } = await adminClient()
    .from("profiles")
    .select("id, full_name, role")
    .order("role")
    .order("full_name");
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name, role: row.role }));
}
