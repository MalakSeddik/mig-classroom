import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Every /admin page is admin-only, no teacher fallback (unlike
 * requireStaff, which lets both roles in) - a teacher landing here gets
 * redirected the same as a student. RLS already backs the real writes
 * (courses/classes are admin-only for insert/delete), but this gives a
 * clean redirect instead of a confusing empty/broken page.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "student" | "teacher" | "admin" }>();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, user };
}
