import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";

/**
 * Thin role dispatcher - admins have their own home at /admin (the shell
 * already routes them there from the logo/nav), so /dashboard only ever
 * renders the student or teacher overview. getCurrentProfile() is
 * cache()-wrapped, so this doesn't duplicate the query the (app) layout
 * already ran for the same request.
 */
export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  // The (app) layout already redirects signed-out/non-approved visitors
  // before this ever renders - this is defense-in-depth, not the gate.
  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  return profile.role === "teacher" ? (
    <TeacherDashboard profile={profile} />
  ) : (
    <StudentDashboard profile={profile} />
  );
}
