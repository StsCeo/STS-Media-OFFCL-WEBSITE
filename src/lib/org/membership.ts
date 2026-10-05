import type { SupabaseClient } from "@supabase/supabase-js";
import { isOrganizationRole, type MembershipStatus, type OrganizationRole } from "@/lib/auth/organization-roles";

export interface ActiveMembershipRecord {
  organizationId: string;
  role: OrganizationRole;
  status: Extract<MembershipStatus, "active">;
}

type MemberRow = {
  organization_id: string;
  role: string;
  status: string;
};

export function pickActiveMembership(rows: MemberRow[] | null | undefined): ActiveMembershipRecord | null {
  const active = (rows ?? []).filter(
    (row): row is MemberRow & { role: OrganizationRole; status: "active" } =>
      row.status === "active" && isOrganizationRole(row.role),
  );
  if (active.length === 1) {
    return {
      organizationId: active[0].organization_id,
      role: active[0].role,
      status: "active",
    };
  }
  const owners = active.filter((row) => row.role === "owner");
  if (owners.length === 1) {
    return {
      organizationId: owners[0].organization_id,
      role: "owner",
      status: "active",
    };
  }
  return null;
}

export async function readActiveMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveMembershipRecord | null> {
  try {
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(8);
    if (error) return null;
    return pickActiveMembership((data ?? []) as MemberRow[]);
  } catch {
    return null;
  }
}
