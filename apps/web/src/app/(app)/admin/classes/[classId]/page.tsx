import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { ClassForm, type ExistingClass } from "../class-form";
import { removeEnrollment } from "./enrollment-actions";
import { StudentPicker } from "./student-picker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type EnrollmentRow = {
  id: string;
  student_id: string;
  profiles: { full_name: string | null } | null;
};

export default async function ManageClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const { supabase } = await requireAdmin();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, course_id, teacher_id, start_date, end_date")
    .eq("id", classId)
    .single<ExistingClass>();

  if (!klass) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Class not found.</p>
      </div>
    );
  }

  const { data: courses } = await supabase.from("courses").select("id, title, level").order("title");
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .order("full_name");

  const { data: roster } = await supabase
    .from("enrollments")
    .select("id, student_id, profiles(full_name)")
    .eq("class_id", classId)
    .returns<EnrollmentRow[]>();

  const enrolledIds = new Set((roster ?? []).map((r) => r.student_id));

  const { data: allStudents } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student")
    .order("full_name");

  const availableStudents = (allStudents ?? []).filter((s) => !enrolledIds.has(s.id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/admin/classes" className="text-sm text-accent hover:underline">
          ← Back to classes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Manage class</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassForm existing={klass} courses={courses ?? []} teachers={teachers ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{roster?.length ?? 0} enrolled students</CardTitle>
        </CardHeader>
        <CardContent>
          {roster && roster.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {roster.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{r.profiles?.full_name ?? r.student_id}</span>
                  <form action={removeEnrollment.bind(null, classId, r.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add students</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentPicker classId={classId} students={availableStudents} />
        </CardContent>
      </Card>
    </div>
  );
}
