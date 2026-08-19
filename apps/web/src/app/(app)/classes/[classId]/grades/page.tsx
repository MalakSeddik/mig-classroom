import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type Profile = { role: "student" | "teacher" | "admin" };
type ClassRow = { id: string; name: string; teacher_id: string | null };
type RosterRow = { student_id: string; profiles: { full_name: string | null } | null };
type AssignmentRow = { id: string; title: string; max_points: number };
type SubmissionRow = { id: string; assignment_id: string; student_id: string; grades: { points: number } | null };
type ExamRow = { id: string; title: string; is_certification: boolean };
type ExamQuestionRow = { exam_id: string; points_override: number | null; question_bank: { points: number } | null };
type AttemptRow = { id: string; exam_id: string; student_id: string; status: string; total_score: number | null };

type UngradedItem = { title: string; kind: string; href: string };

export default async function ClassGradesPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
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
    .single<Profile>();

  // classes_select's RLS already scopes this to admins, the class's own
  // teacher, or an enrolled student - same pattern as the attendance and
  // class pages. This page is staff-only, though, so a student who
  // reaches it is redirected back to the class page below.
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, teacher_id")
    .eq("id", classId)
    .single<ClassRow>();

  if (!klass) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          Class not found, or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  const isStaffView = klass.teacher_id === user.id || profile?.role === "admin";

  if (!isStaffView) {
    redirect(`/classes/${classId}`);
  }

  const { data: roster } = await supabase
    .from("enrollments")
    .select("student_id, profiles(full_name)")
    .eq("class_id", classId)
    .returns<RosterRow[]>();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, max_points")
    .eq("class_id", classId)
    .returns<AssignmentRow[]>();

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, student_id, grades(points)")
        .in("assignment_id", assignmentIds)
        .returns<SubmissionRow[]>()
    : { data: [] as SubmissionRow[] };

  // Same convention the exam grading queue already established: "this
  // class's exams" means exams.class_id = this class, not the
  // exam_assignments fan-out - see the grading queue's own comment on
  // exam_attempts_staff_all for why that's the right scope here too.
  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, is_certification")
    .eq("class_id", classId)
    .returns<ExamRow[]>();

  const examIds = (exams ?? []).map((e) => e.id);

  // Staff already has full RLS read access to exam_questions/
  // question_bank (the staff-only "for all" policy from Step 5 part 1),
  // so this can go through the regular signed-in client - no admin
  // client needed here, unlike the student-facing getMyExamSummaries().
  const { data: examQuestions } = examIds.length
    ? await supabase
        .from("exam_questions")
        .select("exam_id, points_override, question_bank(points)")
        .in("exam_id", examIds)
        .returns<ExamQuestionRow[]>()
    : { data: [] as ExamQuestionRow[] };

  const maxByExam = new Map<string, number>();
  for (const eq of examQuestions ?? []) {
    const pts = eq.points_override ?? eq.question_bank?.points ?? 0;
    maxByExam.set(eq.exam_id, (maxByExam.get(eq.exam_id) ?? 0) + pts);
  }

  const { data: attempts } = examIds.length
    ? await supabase
        .from("exam_attempts")
        .select("id, exam_id, student_id, status, total_score")
        .in("exam_id", examIds)
        .returns<AttemptRow[]>()
    : { data: [] as AttemptRow[] };

  const students = (roster ?? [])
    .map((r) => ({ id: r.student_id, name: r.profiles?.full_name ?? "Unknown student" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = students.map((student) => {
    let earned = 0;
    let possible = 0;
    const ungraded: UngradedItem[] = [];

    for (const a of assignments ?? []) {
      const sub = (submissions ?? []).find((s) => s.assignment_id === a.id && s.student_id === student.id);
      if (!sub) continue; // not submitted yet - nothing to grade or count
      if (sub.grades) {
        earned += sub.grades.points;
        possible += a.max_points;
      } else {
        ungraded.push({
          title: a.title,
          kind: "Assignment",
          href: `/classes/${classId}/assignments/${a.id}/submissions/${sub.id}`,
        });
      }
    }

    for (const e of exams ?? []) {
      const attempt = (attempts ?? []).find((a) => a.exam_id === e.id && a.student_id === student.id);
      if (!attempt || attempt.status === "in_progress") continue; // not taken, or still in progress
      const maxScore = maxByExam.get(e.id) ?? 0;
      if (attempt.status === "final") {
        earned += attempt.total_score ?? 0;
        possible += maxScore;
      } else {
        // auto_graded - some objective questions are already scored, but
        // a writing/speaking answer is still waiting on a teacher, so
        // this is provisional, not a finished grade.
        if (attempt.total_score !== null) {
          earned += attempt.total_score;
          possible += maxScore;
        }
        ungraded.push({
          title: e.title,
          kind: e.is_certification ? "Exam" : "Quiz",
          href: `/exams/grading/${attempt.id}`,
        });
      }
    }

    return { student, earned, possible, ungraded };
  });

  const totalUngraded = rows.reduce((sum, r) => sum + r.ungraded.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-accent hover:underline">
          ← Back to class
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Grades</h1>
        <p className="text-muted-foreground">
          {klass.name} · {(assignments ?? []).length} assignments, {(exams ?? []).length} exams
          {totalUngraded > 0 && ` · ${totalUngraded} ungraded`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{students.length} enrolled</CardTitle>
          <CardDescription>
            Points shown only count graded or provisionally-scored work - ungraded items are listed, not
            counted as zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {rows.map(({ student, earned, possible, ungraded }) => (
                <li key={student.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{student.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {possible > 0 ? `${earned} / ${possible} pts` : "Nothing graded yet"}
                      </span>
                      {ungraded.length > 0 && <Badge variant="secondary">{ungraded.length} ungraded</Badge>}
                    </span>
                  </div>
                  {ungraded.length > 0 && (
                    <ul className="flex flex-col gap-1 border-t border-border pt-2">
                      {ungraded.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="flex items-center justify-between text-sm text-accent hover:underline"
                          >
                            <span>
                              {item.title} <span className="text-muted-foreground">({item.kind})</span>
                            </span>
                            <span aria-hidden>→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
