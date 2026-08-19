import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

/**
 * Wraps every real, authenticated area of the app (dashboard, classes,
 * exams, admin, grades) in the shared sidebar/nav shell - a route group
 * so the URLs themselves are unaffected (/dashboard is still /dashboard).
 * /login, /signup, /pending, and the marketing "/" page stay outside this
 * group deliberately: they either don't need nav, or (pending) shouldn't
 * show nav to areas the user can't actually reach yet.
 *
 * Middleware already redirects signed-out or non-approved visitors before
 * they reach anything under here - these two checks are defense-in-depth,
 * same reasoning as every other page in this app that re-checks itself.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  if (profile.status !== "approved") {
    redirect("/pending");
  }

  let pendingRegistrations = 0;
  if (profile.role === "admin") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingRegistrations = count ?? 0;
  }

  return (
    <AppShell profile={profile} pendingRegistrations={pendingRegistrations}>
      {children}
    </AppShell>
  );
}
