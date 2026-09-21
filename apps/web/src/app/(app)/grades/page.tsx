import Link from "next/link";
import { requireStudent } from "@/lib/supabase/require-student";
import { finalizeExpiredIfNeeded, getMyExamSummaries } from "@/lib/exams/attempt-engine";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type SubmissionRow = {
  id: string;
  assignments: {
    id: string;
    title: string;
    max_points: number;
    class_id: string;
    classes: { name: string } | null;
  } | null;
  grades: { points: number } | null;
};

type GradeItem = {
  id: string;
  title: string;
  kind: "assignment" | "quiz" | "exam";
  className: string;
  score: number | null;
  maxScore: number;
  status: "graded" | "pending" | "provisional";
  href: string;
};

const KIND_LABEL: Record<GradeItem["kind"], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  exam: "Exam",
};

const STATUS_BADGE: Record<GradeItem["status"], { label: string; className: string }> = {
  graded: { label: "Graded", className: "bg-success text-success-foreground" },
  provisional: { label: "Provisional", className: "" },
  pending: { label: "Pending", className: "" },
};

const UNGROUPED_LABEL = "Certification / Standalone";

export default async function MyGradesPage() {
  const { supabase, user } = await requireStudent();

  // Same "finalize on read" sweep the my-exams/results pages already do,
  // so a nobody-ever-revisited expired attempt doesn't sit in_progress
  // (and therefore invisible here) forever.
  await finalizeExpiredIfNeeded();

  // submissions_select's RLS (student_id = auth.uid()) already scopes
  // this to the caller's own rows - filtered explicitly too, same
  // belt-and-suspenders style used elsewhere in this app.
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assignments(id, title, max_points, class_id, classes(name)), grades(points)")
    .eq("student_id", user.id)
    .returns<SubmissionRow[]>();

  const items: GradeItem[] = [];

  for (const s of submissions ?? []) {
    const a = s.assignments;
    if (!a) continue;
    const graded = s.grades;
    items.push({
      id: `assignment-${s.id}`,
      title: a.title,
      kind: "assignment",
      className: a.classes?.name ?? UNGROUPED_LABEL,
      score: graded?.points ?? null,
      maxScore: a.max_points,
      // Never invent a zero for ungraded work - "pending" carries no
      // score at all, it's excluded from the class summary below rather
      // than counted against the student.
      status: graded ? "graded" : "pending",
      href: `/classes/${a.class_id}/assignments/${a.id}`,
    });
  }

  const examSummaries = await getMyExamSummaries();
  for (const e of examSummaries) {
    items.push({
      id: `exam-${e.attemptId}`,
      title: e.examTitle,
      kind: e.isCertification ? "exam" : "quiz",
      className: e.className ?? UNGROUPED_LABEL,
      score: e.totalScore,
      maxScore: e.maxScore,
      status: e.status === "final" ? "graded" : "provisional",
      href: `/exams/my-exams/${e.examId}/results`,
    });
  }

  const byClass = new Map<string, GradeItem[]>();
  for (const item of items) {
    const list = byClass.get(item.className) ?? [];
    list.push(item);
    byClass.set(item.className, list);
  }

  const classNames = [...byClass.keys()].sort((a, b) =>
    a === UNGROUPED_LABEL ? 1 : b === UNGROUPED_LABEL ? -1 : a.localeCompare(b)
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">My grades</h1>

      {classNames.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing graded or submitted yet.</p>
      )}

      {classNames.map((className) => {
        const classItems = byClass.get(className)!;
        // Only items with an actual recorded score count toward the
        // summary - pending work isn't counted as zero, and isn't
        // counted at all, so the fraction stays honest.
        const scored = classItems.filter((i) => i.score !== null);
        const earned = scored.reduce((sum, i) => sum + (i.score ?? 0), 0);
        const possible = scored.reduce((sum, i) => sum + i.maxScore, 0);
        const pendingCount = classItems.length - scored.length;

        return (
          <Card key={className}>
            <CardHeader>
              <CardTitle>{className}</CardTitle>
              <CardDescription>
                {possible > 0 ? `${earned} / ${possible} points earned` : "Nothing graded yet"}
                {pendingCount > 0 && ` · ${pendingCount} pending`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {classItems.map((item) => {
                  const badge = STATUS_BADGE[item.status];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                      >
                        <span className="flex flex-col">
                          <span>{item.title}</span>
                          <span className="text-xs text-muted-foreground">{KIND_LABEL[item.kind]}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {item.score !== null ? (
                            <span>
                              {item.score} / {item.maxScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-- / {item.maxScore}</span>
                          )}
                          <Badge
                            className={badge.className}
                            variant={badge.className ? undefined : "secondary"}
                          >
                            {badge.label}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
