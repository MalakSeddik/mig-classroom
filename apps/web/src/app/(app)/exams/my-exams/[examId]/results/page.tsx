import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/supabase/require-student";
import { finalizeExpiredIfNeeded, getAttemptBreakdown } from "@/lib/exams/attempt-engine";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  auto_graded: "Provisional",
  final: "Final",
  expired: "Time expired",
};

export default async function ExamResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const { supabase, user } = await requireStudent();

  await finalizeExpiredIfNeeded();

  const { data: attemptRow } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!attemptRow) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-12">
        <p className="text-muted-foreground">No attempt found for this exam.</p>
        <Link href="/exams/my-exams" className="text-sm text-accent hover:underline">
          ← Back to my exams
        </Link>
      </div>
    );
  }

  const breakdown = await getAttemptBreakdown(attemptRow.id);
  if ("error" in breakdown) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12">
        <p className="text-destructive">{breakdown.error}</p>
      </div>
    );
  }

  const { attempt, items } = breakdown;

  if (attempt.status === "in_progress") {
    redirect(`/exams/my-exams/${examId}`);
  }

  const isProvisional = attempt.status === "auto_graded";
  const passed =
    attempt.isCertification && attempt.passingScore !== null && attempt.totalScore !== null
      ? attempt.totalScore >= attempt.passingScore
      : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/exams/my-exams" className="text-sm text-accent hover:underline">
          ← Back to my exams
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{attempt.examTitle}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {attempt.totalScore ?? 0} pts
            <Badge variant={isProvisional ? "secondary" : "default"}>
              {isProvisional ? "Provisional" : STATUS_LABEL[attempt.status] ?? attempt.status}
            </Badge>
            {passed !== null && (
              <Badge variant={passed ? "default" : "destructive"}>{passed ? "Passed" : "Not passed"}</Badge>
            )}
          </CardTitle>
          {(attempt.isLate || attempt.autoSubmitted) && (
            <CardDescription className="text-warning">
              {attempt.autoSubmitted
                ? "Automatically submitted after time ran out."
                : "Submitted after the time limit."}
            </CardDescription>
          )}
          {isProvisional && (
            <CardDescription>
              Some questions are still awaiting teacher grading - this score may change.
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {items.map((item, i) => (
              <li key={item.questionId} className="flex flex-col gap-1 rounded-md border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>#{i + 1}</span>
                  <span>{item.maxPoints} pts</span>
                  {item.isCorrect === true && <Badge>Correct</Badge>}
                  {item.isCorrect === false && <Badge variant="destructive">Incorrect</Badge>}
                  {item.isCorrect === null && item.pointsAwarded === null && (
                    <Badge variant="secondary">Pending teacher review</Badge>
                  )}
                  {item.pointsAwarded !== null && <span>{item.pointsAwarded} pts awarded</span>}
                </div>
                <p className="text-sm font-medium">{item.prompt}</p>
                {item.mediaUrl &&
                  (item.mediaType?.startsWith("audio/") ? (
                    <audio controls src={item.mediaUrl} className="h-9 w-full max-w-sm" />
                  ) : (
                    <img src={item.mediaUrl} alt="Question media" className="max-h-48 rounded-md border border-border" />
                  ))}
                {item.type === "speaking" && item.answerAudioUrl ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Your answer:</span>
                    <audio controls src={item.answerAudioUrl} className="h-9 w-full max-w-sm" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your answer: {item.response ?? <em>no answer</em>}
                  </p>
                )}
                {item.feedback && <p className="text-sm">Feedback: {item.feedback}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
