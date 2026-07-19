"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAnswer, submitExam, type SafeQuestion } from "@/lib/exams/attempt-engine";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SAVE_DEBOUNCE_MS = 1000;

function formatRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamTakingForm({
  examId,
  attemptId,
  startedAt,
  durationMinutes,
  questions,
  existingAnswers,
}: {
  examId: string;
  attemptId: string;
  startedAt: string;
  durationMinutes: number;
  questions: SafeQuestion[];
  existingAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(existingAnswers);
  const [pageIndex, setPageIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const deadlineMs = useMemo(
    () => new Date(startedAt).getTime() + durationMinutes * 60 * 1000,
    [startedAt, durationMinutes]
  );
  const [remainingSeconds, setRemainingSeconds] = useState(() => (deadlineMs - Date.now()) / 1000);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submittingRef = useRef(false);

  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const finalAnswers = Object.entries(answers).map(([questionId, response]) => ({ questionId, response }));
    const result = await submitExam(attemptId, finalAnswers);

    if (result.error) {
      setSubmitError(result.error);
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    router.push(`/exams/my-exams/${examId}/results`);
  }, [answers, attemptId, examId, router]);

  // Client-side countdown - purely cosmetic. The real time enforcement
  // happens server-side in finalizeAttempt, computed from the DB's own
  // started_at, never from anything this clock says.
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = (deadlineMs - Date.now()) / 1000;
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        doSubmit();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs, doSubmit]);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      saveAnswer(attemptId, questionId, value);
    }, SAVE_DEBOUNCE_MS);
  }

  const question = questions[pageIndex];
  const isLastPage = pageIndex === questions.length - 1;
  const isLowTime = remainingSeconds <= 60;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <span className="text-sm text-muted-foreground">
          Question {pageIndex + 1} of {questions.length}
        </span>
        <Badge variant={isLowTime ? "destructive" : "secondary"}>
          {formatRemaining(remainingSeconds)} remaining
        </Badge>
      </div>

      {question && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <p className="font-medium">{question.prompt}</p>
          <p className="text-xs text-muted-foreground">{question.points} pts</p>

          {question.mediaUrl &&
            (question.mediaType?.startsWith("audio/") ? (
              <audio controls src={question.mediaUrl} className="h-10 w-full max-w-sm" />
            ) : (
              <img src={question.mediaUrl} alt="Question media" className="max-h-64 rounded-md border border-border" />
            ))}

          {question.type === "multiple_choice" && question.options && (
            <div className="flex flex-col gap-2">
              {question.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={opt}
                    checked={answers[question.id] === opt}
                    onChange={() => handleAnswerChange(question.id, opt)}
                    className="accent-primary"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {question.type === "true_false" && (
            <div className="flex gap-4">
              {["true", "false"].map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={v}
                    checked={answers[question.id] === v}
                    onChange={() => handleAnswerChange(question.id, v)}
                    className="accent-primary"
                  />
                  {v === "true" ? "True" : "False"}
                </label>
              ))}
            </div>
          )}

          {question.type === "short_answer" && (
            <input
              type="text"
              value={answers[question.id] ?? ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          )}

          {(question.type === "writing" || question.type === "speaking") && (
            <Textarea
              rows={5}
              value={answers[question.id] ?? ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={
                question.type === "speaking"
                  ? "Describe what you would say (typed response for now)."
                  : undefined
              }
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </Button>

        {isLastPage ? (
          <Button type="button" onClick={doSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit exam"}
          </Button>
        ) : (
          <Button type="button" onClick={() => setPageIndex((i) => Math.min(questions.length - 1, i + 1))}>
            Next
          </Button>
        )}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </div>
  );
}
