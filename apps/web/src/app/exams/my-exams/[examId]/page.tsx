import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startOrResumeAttempt } from "@/lib/exams/attempt-engine";
import { ExamTakingForm } from "@/components/exam-taking-form";
import { LocalDateTime } from "@/components/local-date-time";

export default async function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await startOrResumeAttempt(examId);

  if (result.kind === "error") {
    return <InfoMessage message={result.message} />;
  }

  if (result.kind === "not-assigned") {
    return <InfoMessage message="This exam isn't assigned to you." />;
  }

  if (result.kind === "not-open") {
    return (
      <InfoMessage
        message={
          result.reason === "not-open-yet" ? (
            <>
              This exam opens <LocalDateTime value={result.opensAt} />.
            </>
          ) : (
            "This exam's window has closed."
          )
        }
      />
    );
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
