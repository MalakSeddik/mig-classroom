"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export type UserActionState = {
  error: string | null;
};

const ASSIGNABLE_ROLES = ["student", "teacher", "admin"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * The general, admin-only role-change tool for an already-processed user
 * - deliberately separate from registrations/actions.ts's
 * approveRegistration(), which stays intentionally restricted to
 * student/teacher only (see its own doc comment on why granting admin
 * was kept a deliberately higher-friction, SQL-only action). This
 * function DOES allow granting admin, since a full user-management table
 * is a real, considered change to that trust model, not an oversight -
 * see CLAUDE.md's "Admin user management" section.
 */
export async function changeUserRole(
  userId: string,
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const newRole = formData.get("role") as string;
  if (!ASSIGNABLE_ROLES.includes(newRole as AssignableRole)) {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<{ role: string }>();
  if (!target) return { error: "User not found." };
  if (target.role === newRole) return { error: null };

  // Guard 1: an admin can never remove their own admin role, full stop -
  // not just when they happen to be the last one. Self-demotion has no
  // legitimate use case here and risks an accidental, hard-to-reverse
  // lockout (protect_profile_role's own bootstrap exception only covers
  // service_role/direct-SQL contexts, not a signed-in admin acting on
  // themselves).
  if (userId === user.id && target.role === "admin" && newRole !== "admin") {
    return { error: "You can't remove your own admin role." };
  }

  // Guard 2: the last remaining admin can't be demoted by anyone,
  // including another admin. Counts EVERY role='admin' row regardless of
  // status (not just approved/active ones) - even a disabled admin
  // account is still a recoverable seed for getting admin access back by
  // re-enabling it; demoting its role too would mean no path back to
  // admin without raw SQL.
  if (target.role === "admin" && newRole !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Can't demote the last remaining admin." };
    }
  }

  // .select() after the write, not just checking `error`, matters here:
  // an RLS-blocked UPDATE succeeds with zero rows affected rather than
  // raising an error (the exact gotcha documented in CLAUDE.md's "Access
  // model (RLS)" section) - assertAdmin() above only checks the caller's
  // `role` column, not `status`, so this is the real backstop if a
  // caller's profiles_update_admin RLS grant (which does require
  // is_admin(), i.e. an approved admin) doesn't actually apply.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Update was not applied." };

  revalidatePath("/admin");
  return { error: null };
}

/**
 * Suspend ("disable") or re-enable an already-processed account.
 * Deliberately only ever toggles between 'approved' and 'disabled' - a
 * still-'pending' row goes through approveRegistration()/
 * rejectRegistration() instead (the dedicated new-signup flow, reused
 * as-is), and a 'rejected' row is re-enabled through this same function
 * (newStatus: 'approved') rather than needing a third status value.
 */
export async function setUserStatus(
  userId: string,
  newStatus: "approved" | "disabled"
): Promise<UserActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { data: target } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single<{ role: string; status: string }>();
  if (!target) return { error: "User not found." };
  if (target.status === newStatus) return { error: null };

  if (newStatus === "disabled") {
    // An admin can't disable their own account - protect_profile_role's
    // is_admin() check would immediately lock them out of undoing it
    // themselves, leaving only service_role/direct SQL as a way back in.
    if (userId === user.id) {
      return { error: "You can't disable your own account." };
    }
    // The last remaining ACTIVE admin (role='admin' AND status='approved')
    // can't be disabled by anyone else either - unlike the role-demotion
    // guard above, a disabled-but-still-role-admin row doesn't count here,
    // since the harm being prevented is "zero people can currently act as
    // admin", not "the admin role is gone forever".
    if (target.role === "admin") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "approved");
      if ((count ?? 0) <= 1) {
        return { error: "Can't disable the last remaining active admin." };
      }
    }
  }

  // Same "check affected rows, not just error" reasoning as
  // changeUserRole above.
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Update was not applied." };

  revalidatePath("/admin");
  return { error: null };
}
