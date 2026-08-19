import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { ClassForm } from "./class-form";
import { DeleteClassDialog } from "./delete-class-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type ClassRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  courses: { title: string; level: string } | null;
  profiles: { full_name: string | null } | null;
};

export default async function AdminClassesPage() {
  const { supabase } = await requireAdmin();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, start_date, end_date, courses(title, level), profiles(full_name)")
    .order("name")
    .returns<ClassRow[]>();

  const classesWithCounts = await Promise.all(
    (classes ?? []).map(async (c) => {
      const [{ count: enrollmentCount }, { count: assignmentCount }, { count: examCount }] = await Promise.all([
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("class_id", c.id),
        supabase.from("assignments").select("id", { count: "exact", head: true }).eq("class_id", c.id),
        supabase.from("exams").select("id", { count: "exact", head: true }).eq("class_id", c.id),
      ]);
      return {
        ...c,
        enrollmentCount: enrollmentCount ?? 0,
        assignmentCount: assignmentCount ?? 0,
        examCount: examCount ?? 0,
      };
    })
  );

  const { data: courses } = await supabase.from("courses").select("id, title, level").order("title");
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .order("full_name");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Admin
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{classesWithCounts.length} classes</CardTitle>
        </CardHeader>
        <CardContent>
          {classesWithCounts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {classesWithCounts.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.courses && <Badge variant="secondary">{c.courses.level}</Badge>}
                      <span>{c.courses?.title ?? "Unknown course"}</span>
                      <span>·</span>
                      <span>{c.profiles?.full_name ?? "Unassigned"}</span>
                    </div>
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.start_date ?? "no start"} – {c.end_date ?? "no end"} · {c.enrollmentCount} student
                      {c.enrollmentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/classes/${c.id}`}>Manage</Link>
                    </Button>
                    <DeleteClassDialog
                      classId={c.id}
                      name={c.name}
                      enrollmentCount={c.enrollmentCount}
                      assignmentCount={c.assignmentCount}
                      examCount={c.examCount}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New class</CardTitle>
          <CardDescription>Manage its student roster afterward from the class page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClassForm courses={courses ?? []} teachers={teachers ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
