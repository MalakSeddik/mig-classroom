import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Explicit, code-level admin check for use INSIDE Server Actions (as
 * opposed to requireAdmin(), which is for pages and redirects on
 * failure). Every /admin mutation checks this explicitly as defense in
 * depth alongside RLS, since this whole section has no legitimate
 * non-admin caller - not because RLS itself was found to be wrong (an
 * initial verification pass suggested courses/classes UPDATE/DELETE
 * weren't admin-gated, but that was a false alarm from a test script bug
 * - checking only `error` instead of actual rows affected, exactly the
 * gotcha documented in CLAUDE.md's "Access model (RLS)" section. RLS was
 * correct the whole time; this check is a deliberate belt-and-suspenders
 * addition, not a patch for a real hole).
 */
export async function assertAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<{ role: "student" | "teacher" | "admin" }>();

  if (profile?.role !== "admin") {
    return "Admin access required.";
  }
  return null;
}
