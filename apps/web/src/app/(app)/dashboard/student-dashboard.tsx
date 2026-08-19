import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyExamSummaries } from "@/lib/exams/attempt-engine";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { CurrentProfile } from "@/lib/supabase/current-user";

type ClassRow = { id: string; name: string; courses: { title: string; level: string } | null };

type AssignmentRow = {
  id: string;
  title: string;
  due_date: string | null;
  max_points: number;
  class_id: string;
  classes: { name: string } | null;
};

type ExamAssignmentRow = {
  exam_assignments: {
    id: string;
    starts_at: string | null;
    ends_at: string | null;
    exams: { id: string; title: string; is_certification: boolean; classes: { name: string } | null } | null;
  } | null;
};

type AttemptRow = { id: string; exam_id: string; status: string };

type SubmissionRow = {
  id: string;
  submitted_at: string | null;
  assignments: { id: string; title: string; max_points: number; class_id: string } | null;
  grades: { points: number } | null;
};

function windowStatus(starts_at: string | null, ends_at: string | null, now: number) {
  const startsAtMs = starts_at ? new Date(starts_at).getTime() : null;
  const endsAtMs = ends_at ? new Date(ends_at).getTime() : null;
  if (startsAtMs !== null && now < startsAtMs) return "upcoming" as const;
  if (endsAtMs !== null && now > endsAtMs) return "closed" as const;
  return "open" as const;
}

export async function StudentDashboard({ profile }: { profile: CurrentProfile }) {
  const supabase = await createClient();
  // react-hooks/purity is aimed at client components the React Compiler
  // memoizes across re-renders - it doesn't apply to an async Server
  // Component, which runs exactly once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, courses(title, level)")
    .order("name")
    .returns<ClassRow[]>();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, due_date, max_points, class_id, classes(name)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<AssignmentRow[]>();

  const { data: mySubmissions } = await supabase
    .from("submissions")
    .select("id, submitted_at, assignments(id, title, max_points, class_id), grades(points)")
    .eq("student_id", profile.id)
    .order("submitted_at", { ascending: false })
    .returns<SubmissionRow[]>();

  const submittedAssignmentIds = new Set((mySubmissions ?? []).map((s) => s.assignments?.id).filter(Boolean));

  const upcomingAssignments = (assignments ?? [])
    .filter((a) => !submittedAssignmentIds.has(a.id) && (!a.due_date || new Date(a.due_date).getTime() >= now))
    .slice(0, 5);

  const { data: myExamAssignments } = await supabase
    .from("exam_assignment_students")
    .select("exam_assignments(id, starts_at, ends_at, exams(id, title, is_certification, classes(name)))")
    .eq("student_id", profile.id)
    .returns<ExamAssignmentRow[]>();

  const { data: myAttempts } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, status")
    .eq("student_id", profile.id)
    .returns<AttemptRow[]>();

  const attemptByExam = new Map((myAttempts ?? []).map((a) => [a.exam_id, a]));

  const seenExamIds = new Set<string>();
  const upcomingExams = (myExamAssignments ?? [])
    .map((r) => r.exam_assignments)
    .filter((a): a is NonNullable<ExamAssignmentRow["exam_assignments"]> => a !== null && a.exams !== null)
    .filter((a) => {
      if (seenExamIds.has(a.exams!.id)) return false;
      seenExamIds.add(a.exams!.id);
      const attempt = attemptByExam.get(a.exams!.id);
      if (attempt && attempt.status !== "in_progress") return false; // already finished
      const status = windowStatus(a.starts_at, a.ends_at, now);
      return status !== "closed";
    })
    .sort((a, b) => {
      const aStatus = windowStatus(a.starts_at, a.ends_at, now);
      const bStatus = windowStatus(b.starts_at, b.ends_at, now);
      if (aStatus !== bStatus) return aStatus === "open" ? -1 : 1; // open exams first
      return new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime();
    })
    .slice(0, 5);

  const examSummaries = await getMyExamSummaries();
  const recentExamResults = examSummaries.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {profile.fullName || profile.email}</h1>
        <p className="text-muted-foreground">Here&apos;s what needs your attention.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Assignments and exams coming up.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAssignments.length === 0 && upcomingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due right now - you&apos;re caught up.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcomingAssignments.map((a) => (
                  <li key={`a-${a.id}`}>
                    <Link
                      href={`/classes/${a.class_id}/assignments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{a.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {a.classes?.name} · Assignment
                        </span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : "No due date"}
                      </Badge>
                    </Link>
                  </li>
                ))}
                {upcomingExams.map((a) => {
                  const status = windowStatus(a.starts_at, a.ends_at, now);
                  return (
                    <li key={`e-${a.exams!.id}`}>
                      <Link
                        href={`/exams/my-exams/${a.exams!.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{a.exams!.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {a.exams!.classes?.name ?? "Certification"} ·{" "}
                            {a.exams!.is_certification ? "Exam" : "Quiz"}
                          </span>
                        </span>
                        {status === "upcoming" ? (
                          <Badge variant="secondary" className="shrink-0">
                            Opens {new Date(a.starts_at!).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-success text-success-foreground">Open now</Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My classes</CardTitle>
          </CardHeader>
          <CardContent>
            {classes && classes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {classes.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/classes/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.courses?.title} · {c.courses?.level}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not enrolled in any classes yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent grades &amp; feedback</CardTitle>
            <CardDescription>Pending work is shown as pending, never as a zero.</CardDescription>
          </CardHeader>
          <CardContent>
            {(mySubmissions?.length ?? 0) === 0 && recentExamResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions or exam attempts yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(mySubmissions ?? []).slice(0, 5).map((s) => {
                  const a = s.assignments;
                  if (!a) return null;
                  return (
                    <li key={`s-${s.id}`}>
                      <Link
                        href={`/classes/${a.class_id}/assignments/${a.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{a.title}</span>
                          <span className="text-xs text-muted-foreground">Assignment</span>
                        </span>
                        {s.grades ? (
                          <span className="shrink-0 text-sm font-medium">
                            {s.grades.points} / {a.max_points}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">
                            Pending
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {recentExamResults.map((e) => (
                  <li key={`r-${e.attemptId}`}>
                    <Link
                      href={`/exams/my-exams/${e.examId}/results`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{e.examTitle}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.isCertification ? "Exam" : "Quiz"}
                        </span>
                      </span>
                      {e.status === "final" ? (
                        <span className="shrink-0 text-sm font-medium">
                          {e.totalScore} / {e.maxScore}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Provisional: {e.totalScore} / {e.maxScore}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
