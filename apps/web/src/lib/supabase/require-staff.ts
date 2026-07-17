import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Every exam-authoring page is staff-only with no student-facing
 * fallback (unlike classes/assignments, which serve both roles). RLS
 * already returns nothing to a student who somehow lands here, but this
 * redirects them outright rather than showing an empty/broken page.
 */
export async function requireStaff() {
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

  if (profile?.role !== "admin" && profile?.role !== "teacher") {
    redirect("/dashboard");
  }

  return { supabase, user, role: profile.role };
}
