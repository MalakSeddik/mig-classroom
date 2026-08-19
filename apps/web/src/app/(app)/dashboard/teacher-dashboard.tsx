import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { CurrentProfile } from "@/lib/supabase/current-user";

type ClassRow = { id: string; name: string; courses: { title: string; level: string } | null };
type AssignmentRow = {
  id: string;
  title: string;
  due_date: string | null;
  class_id: string;
  classes: { name: string } | null;
};
type SubmissionRow = {
  id: string;
  assignment_id: string;
  profiles: { full_name: string | null } | null;
  grades: { id: string } | null;
};
type ExamRow = {
  id: string;
  title: string;
  is_certification: boolean;
  class_id: string | null;
  classes: { name: string } | null;
};
type AttemptRow = {
  id: string;
  status: string;
  exam_id: string;
  profiles: { full_name: string | null } | null;
  exams: { id: string; title: string; class_id: string | null } | null;
};

type NeedsGradingItem = { key: string; title: string; kind: string; who: string; href: string };

export async function TeacherDashboard({ profile }: { profile: CurrentProfile }) {
  const supabase = await createClient();

  // classes_select's RLS already scopes this to the classes this teacher
  // teaches - nothing extra to filter on top of that.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, courses(title, level)")
    .order("name")
    .returns<ClassRow[]>();

  const classIds = (classes ?? []).map((c) => c.id);

  const { data: enrollmentRows } = classIds.length
    ? await supabase.from("enrollments").select("class_id").in("class_id", classIds)
    : { data: [] as { class_id: string }[] };
  const studentCountByClass = new Map<string, number>();
  for (const e of enrollmentRows ?? []) {
    studentCountByClass.set(e.class_id, (studentCountByClass.get(e.class_id) ?? 0) + 1);
  }

  const { data: assignments } = classIds.length
    ? await supabase
        .from("assignments")
        .select("id, title, due_date, class_id, classes(name)")
        .in("class_id", classIds)
        .order("due_date", { ascending: false })
        .returns<AssignmentRow[]>()
    : { data: [] as AssignmentRow[] };

  const assignmentCountByClass = new Map<string, number>();
  for (const a of assignments ?? []) {
    assignmentCountByClass.set(a.class_id, (assignmentCountByClass.get(a.class_id) ?? 0) + 1);
  }

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, profiles(full_name), grades(id)")
        .in("assignment_id", assignmentIds)
        .returns<SubmissionRow[]>()
    : { data: [] as SubmissionRow[] };

  const assignmentById = new Map((assignments ?? []).map((a) => [a.id, a]));
  const ungradedSubmissions = (submissions ?? []).filter((s) => !s.grades);

  // Same convention the grading queue and class gradebook already use:
  // "this teacher's exams" means exams.class_id, not the exam_assignments
  // fan-out. exam_attempts is staff-wide RLS ("for all" is_admin/is_teacher),
  // so this is scoped in code, same as those existing pages.
  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, is_certification, class_id, classes(name)")
    .order("created_at", { ascending: false })
    .returns<ExamRow[]>();
  const myExams = (exams ?? []).filter((e) => e.class_id && classIds.includes(e.class_id));
  const myExamIds = new Set(myExams.map((e) => e.id));

  const { data: pendingAttempts } = await supabase
    .from("exam_attempts")
    .select("id, status, exam_id, profiles(full_name), exams(id, title, class_id)")
    .eq("status", "auto_graded")
    .returns<AttemptRow[]>();
  const myPendingAttempts = (pendingAttempts ?? []).filter((a) => a.exam_id && myExamIds.has(a.exam_id));

  const needsGrading: NeedsGradingItem[] = [
    ...ungradedSubmissions.slice(0, 5).map((s) => {
      const a = assignmentById.get(s.assignment_id);
      return {
        key: `s-${s.id}`,
        title: a?.title ?? "Assignment",
        kind: "Assignment",
        who: s.profiles?.full_name ?? "Unknown student",
        href: `/classes/${a?.class_id}/assignments/${s.assignment_id}/submissions/${s.id}`,
      };
    }),
    ...myPendingAttempts.slice(0, 5).map((a) => ({
      key: `e-${a.id}`,
      title: a.exams?.title ?? "Exam",
      kind: "Exam",
      who: a.profiles?.full_name ?? "Unknown student",
      href: `/exams/grading/${a.id}`,
    })),
  ].slice(0, 6);

  const recentAssignments = (assignments ?? []).slice(0, 3);
  const recentExams = myExams.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {profile.fullName || profile.email}</h1>
        <p className="text-muted-foreground">Here&apos;s what needs your attention.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Needs grading
              {needsGrading.length > 0 && (
                <Badge className="bg-gold text-gold-foreground">{needsGrading.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>Submissions and exam answers waiting on you.</CardDescription>
          </CardHeader>
          <CardContent>
            {needsGrading.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {needsGrading.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{item.who}</span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {item.kind}
                      </Badge>
                    </Link>
                  </li>
                ))}
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
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{c.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {c.courses?.title} · {c.courses?.level}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {studentCountByClass.get(c.id) ?? 0} students ·{" "}
                        {assignmentCountByClass.get(c.id) ?? 0} assignments
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not teaching any classes yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exams &amp; assignments</CardTitle>
            <CardDescription>Recently created, across your classes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAssignments.length === 0 && recentExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing created yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentExams.map((e) => (
                  <li key={`ex-${e.id}`}>
                    <Link
                      href={`/exams/${e.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{e.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{e.classes?.name}</span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {e.is_certification ? "Exam" : "Quiz"}
                      </Badge>
                    </Link>
                  </li>
                ))}
                {recentAssignments.map((a) => (
                  <li key={`as-${a.id}`}>
                    <Link
                      href={`/classes/${a.class_id}/assignments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{a.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{a.classes?.name}</span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        Assignment
                      </Badge>
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
