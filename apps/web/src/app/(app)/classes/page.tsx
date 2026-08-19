import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type ClassRow = { id: string; name: string; courses: { title: string; level: string } | null };

/**
 * The "My classes" / "Classes" nav destination - didn't exist before
 * (classes were only reachable via the dashboard's own class list card).
 * Reuses the exact same RLS-scoped query the dashboards already run:
 * classes_select already returns a student's enrolled classes or a
 * teacher's taught classes with zero extra filtering needed here.
 */
export default async function ClassesIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, courses(title, level)")
    .order("name")
    .returns<ClassRow[]>();

  const heading = profile.role === "teacher" ? "Classes I teach" : "My classes";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{classes?.length ?? 0} classes</CardTitle>
        </CardHeader>
        <CardContent>
          {classes && classes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/classes/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:border-accent hover:text-accent"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.courses?.title} · {c.courses?.level}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {profile.role === "teacher" ? "Not teaching any classes yet." : "Not enrolled in any classes yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
