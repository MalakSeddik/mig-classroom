import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type Profile = { full_name: string | null; status: string };

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors before they reach
  // this page, but checking again here is cheap defense-in-depth, same
  // as the dashboard's own re-check.
  if (!user) {
    redirect("/login");
  }

  // profiles_select's `id = auth.uid()` branch is deliberately never
  // gated by is_approved() - this is the one real row a pending or
  // rejected user can still read, so they can see their own status here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, status")
    .eq("id", user.id)
    .single<Profile>();

  // An approved user landing here (a stale bookmark, browser back button)
  // belongs at the real dashboard instead.
  if (profile?.status === "approved") {
    redirect("/dashboard");
  }

  const isRejected = profile?.status === "rejected";
  const isDisabled = profile?.status === "disabled";

  const title = isDisabled
    ? "Account disabled"
    : isRejected
      ? "Registration not approved"
      : "Awaiting approval";
  const description = isDisabled
    ? "An admin has disabled this account. Your data is preserved, but you can't access the app while it's disabled - contact your school admin if you think this is a mistake."
    : isRejected
      ? "An admin reviewed this registration and did not approve it. If you think this is a mistake, contact your school admin."
      : "Your account is waiting for an admin to review and approve it. You'll be able to see your classes, assignments, and exams as soon as that happens - there's nothing else to do in the meantime.";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {title}
            <Badge variant={isRejected || isDisabled ? "destructive" : "secondary"}>
              {profile?.status ?? "pending"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {profile?.full_name ? `Hi ${profile.full_name} - ` : ""}
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
