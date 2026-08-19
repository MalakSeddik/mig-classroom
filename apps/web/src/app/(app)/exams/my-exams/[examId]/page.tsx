import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/supabase/require-student";
import { getExamStartInfo, startOrResumeAttempt } from "@/lib/exams/attempt-engine";
import { ExamTakingForm } from "@/components/exam-taking-form";
import { ExamStartScreen } from "@/components/exam-start-screen";
import { LocalDateTime } from "@/components/local-date-time";

export default async function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  await requireStudent();

  // Read-only first: getExamStartInfo never creates an exam_attempts row,
  // so checking eligibility (and whether this exam has a speaking
  // question, needing a mic-check gate) never starts the clock by itself.
  const info = await getExamStartInfo(examId);

  if (info.kind === "error") {
    return <InfoMessage message={info.message} />;
  }

  if (info.kind === "not-assigned") {
    return <InfoMessage message="This exam isn't assigned to you." />;
  }

  if (info.kind === "not-open") {
    return (
      <InfoMessage
        message={
          info.reason === "not-open-yet" ? (
            <>
              This exam opens <LocalDateTime value={info.opensAt} />.
            </>
          ) : (
            "This exam's window has closed."
          )
        }
      />
    );
  }

  if (info.kind === "already-completed") {
    redirect(`/exams/my-exams/${examId}/results`);
  }

  if (info.kind === "ready") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
        <ExamStartScreen
          examId={examId}
          examTitle={info.examTitle}
          durationMinutes={info.durationMinutes}
          hasSpeaking={info.hasSpeaking}
        />
      </div>
    );
  }

  // info.kind === "resume" - an in_progress attempt already exists (the
  // clock is already running), so there's nothing left to gate on.
  // startOrResumeAttempt is idempotent here: it just finds and returns
  // the existing attempt rather than creating another one.
  const result = await startOrResumeAttempt(examId);

  if (result.kind === "error") {
    return <InfoMessage message={result.message} />;
  }
  if (result.kind === "not-assigned" || result.kind === "not-open") {
    // Shouldn't happen (getExamStartInfo already confirmed eligibility
    // moments ago), but handled for completeness rather than assumed away.
    return <InfoMessage message="This exam is no longer available." />;
  }
  if (result.kind === "already-completed") {
    redirect(`/exams/my-exams/${examId}/results`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <ExamTakingForm
        examId={examId}
        attemptId={result.attempt.id}
        startedAt={result.attempt.startedAt}
        durationMinutes={result.attempt.durationMinutes}
        questions={result.questions}
        existingAnswers={result.existingAnswers}
      />
    </div>
  );
}

function InfoMessage({ message }: { message: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-12">
      <p className="text-muted-foreground">{message}</p>
      <Link href="/exams/my-exams" className="text-sm text-accent hover:underline">
        ← Back to my exams
      </Link>
    </div>
  );
}
