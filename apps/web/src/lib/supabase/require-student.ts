import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * /grades, /exams/my-exams, and their subpages are meaningful only for
 * students - a teacher/admin isn't blocked by RLS (their own
 * student_id-scoped rows just come back empty), so nothing breaks, but
 * landing on an empty "no grades yet" page isn't useful for them either.
 * Redirects them to /dashboard instead, same reasoning as
 * requireStaff()/requireAdmin() redirecting the wrong role away from
 * their own gated pages.
 */
export async function requireStudent() {
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

  if (profile?.role !== "student") {
    redirect("/dashboard");
  }

  return { supabase, user };
}
