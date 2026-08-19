"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export type ApprovalState = {
  error: string | null;
};

/**
 * Approving sets both status='approved' and the real role in one update -
 * the role selector defaults to requested_role but the admin can override
 * it, so this always uses whatever was actually submitted, never blindly
 * trusting the request. Deliberately only ever accepts 'student' or
 * 'teacher' - never 'admin'. Granting admin stays a deliberately
 * higher-friction, SQL-only action (see the bootstrap note in CLAUDE.md);
 * exposing it as a dropdown option here would turn that into a routine
 * one-click UI action, a real change to this app's trust model that
 * wasn't asked for.
 */
export async function approveRegistration(
  userId: string,
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const role = formData.get("role") as string;
  if (role !== "student" && role !== "teacher") {
    return { error: "Choose student or teacher." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) {
    return { error: adminError };
  }

  // protect_profile_role_trigger allows this: the caller is an approved
  // admin (assertAdmin + RLS's profiles_update_admin both already
  // confirmed it), so both the role change and the status change pass.
  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", role })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  return { error: null };
}

export async function rejectRegistration(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return;

  await supabase.from("profiles").update({ status: "rejected" }).eq("id", userId);

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
}
