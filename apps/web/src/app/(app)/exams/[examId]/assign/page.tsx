import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { AssignToClassForm } from "./assign-to-class-form";
import { AssignToStudentsForm } from "./assign-to-students-form";
import { LocalDateTime } from "@/components/local-date-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type ExamRow = {
  id: string;
  title: string;
  class_id: string | null;
  is_certification: boolean;
  classes: { name: string; teacher_id: string } | null;
};

type AssignmentRow = {
  id: string;
  class_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  classes: { name: string } | null;
  exam_assignment_students: { id: string }[];
};

export default async function AssignExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const { supabase, user, role } = await requireStaff();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, class_id, is_certification, classes(name, teacher_id)")
    .eq("id", examId)
    .single<ExamRow>();

  if (!exam) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Exam not found.</p>
      </div>
    );
  }

  const canAssignToClass =
    exam.class_id !== null && (role === "admin" || exam.classes?.teacher_id === user.id);
  const canAssignToStudents = role === "admin";

  const { data: assignments } = await supabase
    .from("exam_assignments")
    .select("id, class_id, starts_at, ends_at, created_at, classes(name), exam_assignment_students(id)")
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
    .returns<AssignmentRow[]>();

  let students: { id: string; full_name: string | null }[] = [];
  if (canAssignToStudents) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "student")
      .order("full_name");
    students = data ?? [];
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/exams/${examId}`} className="text-sm text-accent hover:underline">
          ← Back to exam
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Assign &quot;{exam.title}&quot;</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {a.classes?.name ?? `${a.exam_assignment_students.length} student(s)`}
                    </Badge>
                    {a.starts_at || a.ends_at ? (
                      <span className="text-muted-foreground">
                        {a.starts_at ? <LocalDateTime value={a.starts_at} /> : "no start"} –{" "}
                        {a.ends_at ? <LocalDateTime value={a.ends_at} /> : "no end"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No schedule window</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Not assigned to anyone yet.</p>
          )}
        </CardContent>
      </Card>

      {canAssignToClass && exam.class_id && (
        <Card>
          <CardHeader>
            <CardTitle>Assign to class</CardTitle>
            <CardDescription>
              Every student currently enrolled in {exam.classes?.name} will be able to take this
              exam immediately - no schedule window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssignToClassForm examId={examId} classId={exam.class_id} />
          </CardContent>
        </Card>
      )}

      {canAssignToStudents && (
        <Card>
          <CardHeader>
            <CardTitle>Assign to specific students</CardTitle>
            <CardDescription>
              Pick students directly and optionally set an opening/closing window - typical for a
              certification or final exam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssignToStudentsForm examId={examId} students={students} />
          </CardContent>
        </Card>
      )}

      {!canAssignToClass && !canAssignToStudents && (
        <p className="text-sm text-muted-foreground">
          This exam has no class attached, and only an admin can assign a standalone exam to
          specific students.
        </p>
      )}
    </div>
  );
}
