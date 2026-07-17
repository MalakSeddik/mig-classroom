import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Profile = {
  full_name: string | null;
  role: "student" | "teacher" | "admin";
};

type ClassRow = {
  id: string;
  name: string;
  courses: { title: string; level: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects signed-out visitors before they reach
  // this page, but checking again here is cheap defense-in-depth in case
  // the middleware matcher ever changes.
  if (!user) {
    redirect("/login");
  }

  // Step 3 part 2 added a real "read own profile" policy, so this can
  // now use the regular signed-in client instead of the admin client -
  // RLS itself guarantees this only ever returns the caller's own row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single<Profile>();

  // No role branching in the query itself: classes_select's RLS policy
  // already returns exactly the right rows per role (a teacher's own
  // classes, a student's enrolled classes, or every class for an admin) -
  // this is the same select for everyone, relying on RLS rather than
  // re-checking role in code.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, courses(title, level)")
    .order("name")
    .returns<ClassRow[]>();

  const heading =
    profile?.role === "teacher"
      ? "Classes I teach"
      : profile?.role === "admin"
        ? "All classes"
        : "My classes";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {profile?.full_name || user.email}</CardTitle>
          <CardDescription>
            {profile
              ? `Signed in as ${user.email}`
              : "No profile row found yet - has the signup trigger migration been run?"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            Role:{" "}
            <span className="font-medium text-foreground">
              {profile?.role ?? "unknown"}
            </span>
          </p>
          <LogoutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          {profile?.role === "admin" && (
            <CardDescription>
              A full admin panel is coming later - for now this just lists
              every class, since admins can see everything.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {classes && classes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/classes/${c.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                  >
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {c.courses?.title} · {c.courses?.level}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No classes yet.
            </p>
          )}
        </CardContent>
      </Card>

      {(profile?.role === "teacher" || profile?.role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle>Exams</CardTitle>
            <CardDescription>
              Staff-only for now - student exam-taking comes in a later step.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link
              href="/exams/questions"
              className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
            >
              Question bank
            </Link>
            <Link
              href="/exams"
              className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
            >
              Exams
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
