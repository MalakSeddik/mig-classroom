import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { CourseForm } from "./course-form";
import { DeleteCourseDialog } from "./delete-course-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type CourseRow = {
  id: string;
  title: string;
  level: string;
  description: string | null;
};

export default async function AdminCoursesPage() {
  const { supabase } = await requireAdmin();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, level, description")
    .order("title")
    .returns<CourseRow[]>();

  // Two cheap queries per course (class count, then enrollment count
  // across those classes) - fine at this app's scale, same tradeoff the
  // exam builder already makes for its own totals.
  const coursesWithCounts = await Promise.all(
    (courses ?? []).map(async (c) => {
      const { data: classes } = await supabase.from("classes").select("id").eq("course_id", c.id);
      const classIds = (classes ?? []).map((cl) => cl.id);
      let enrollmentCount = 0;
      if (classIds.length > 0) {
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIds);
        enrollmentCount = count ?? 0;
      }
      return { ...c, classCount: classIds.length, enrollmentCount };
    })
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Admin
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{coursesWithCounts.length} courses</CardTitle>
        </CardHeader>
        <CardContent>
          {coursesWithCounts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {coursesWithCounts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{c.level}</Badge>
                      <span>
                        {c.classCount} class{c.classCount === 1 ? "" : "es"}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    {c.description && <p className="truncate text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/courses/${c.id}`}>Edit</Link>
                    </Button>
                    <DeleteCourseDialog
                      courseId={c.id}
                      title={c.title}
                      classCount={c.classCount}
                      enrollmentCount={c.enrollmentCount}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No courses yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New course</CardTitle>
          <CardDescription>Add classes to it afterward from the Classes screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm />
        </CardContent>
      </Card>
    </div>
  );
}
