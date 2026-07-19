import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizeExpiredIfNeeded } from "@/lib/exams/attempt-engine";
import { LocalDateTime } from "@/components/local-date-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type AssignmentRow = {
  id: string;
  exam_assignments: {
    id: string;
    starts_at: string | null;
    ends_at: string | null;
    exams: {
      id: string;
      title: string;
      level: string;
      duration_minutes: number;
      is_certification: boolean;
    } | null;
  } | null;
};

type AttemptRow = { id: string; exam_id: string; status: string; total_score: number | null };

function windowStatus(starts_at: string | null, ends_at: string | null) {
  const now = Date.now();
  const startsAtMs = starts_at ? new Date(starts_at).getTime() : null;
  const endsAtMs = ends_at ? new Date(ends_at).getTime() : null;
  if (startsAtMs !== null && now < startsAtMs) return "upcoming" as const;
  if (endsAtMs !== null && now > endsAtMs) return "closed" as const;
  return "open" as const;
}

const STATUS_LABEL: Record<string, string> = {
  auto_graded: "Provisional score",
  final: "Final score",
  expired: "Time expired",
};

export default async function MyExamsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await finalizeExpiredIfNeeded();

  const { data: myAssignments } = await supabase
    .from("exam_assignment_students")
    .select("id, exam_assignments(id, starts_at, ends_at, exams(id, title, level, duration_minutes, is_certification))")
    .eq("student_id", user.id)
    .returns<AssignmentRow[]>();

  const { data: myAttempts } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, status, total_score")
    .eq("student_id", user.id)
    .returns<AttemptRow[]>();

  const attemptByExam = new Map((myAttempts ?? []).map((a) => [a.exam_id, a]));

  const seen = new Set<string>();
  const rows = (myAssignments ?? [])
    .map((r) => r.exam_assignments)
    .filter((a): a is NonNullable<AssignmentRow["exam_assignments"]> => a !== null && a.exams !== null)
    .filter((a) => {
      if (seen.has(a.exams!.id)) return false;
      seen.add(a.exams!.id);
      return true;
    });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">My exams</h1>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} assigned</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {rows.map((a) => {
                const exam = a.exams!;
                const attempt = attemptByExam.get(exam.id);
                const status = windowStatus(a.starts_at, a.ends_at);

                return (
                  <li
                    key={exam.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{exam.level}</Badge>
                        {exam.is_certification && (
                          <Badge className="bg-gold text-gold-foreground">Certification</Badge>
                        )}
                        <span>{exam.duration_minutes} min</span>
                      </div>
                      <p className="truncate text-sm font-medium">{exam.title}</p>
                    </div>

                    <div className="shrink-0 text-right text-sm">
                      {attempt && attempt.status === "in_progress" ? (
                        <Link href={`/exams/my-exams/${exam.id}`} className="text-accent hover:underline">
                          Resume
                        </Link>
                      ) : attempt ? (
                        <Link href={`/exams/my-exams/${exam.id}/results`} className="text-accent hover:underline">
                          {STATUS_LABEL[attempt.status] ?? "View results"}
                          {attempt.total_score !== null ? ` (${attempt.total_score} pts)` : ""}
                        </Link>
                      ) : status === "open" ? (
                        <Link href={`/exams/my-exams/${exam.id}`} className="text-accent hover:underline">
                          Take exam
                        </Link>
                      ) : status === "upcoming" ? (
                        <span className="text-muted-foreground">
                          Opens <LocalDateTime value={a.starts_at} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No exams assigned to you yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
