import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { createSignedUrl } from "@/lib/supabase/signed-url";
import { isAutoGraded } from "@/lib/exams/constants";
import { GradeAnswerForm } from "./grade-answer-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type AttemptRow = {
  id: string;
  exam_id: string;
  status: string;
  total_score: number | null;
  is_late: boolean;
  auto_submitted: boolean;
  profiles: { full_name: string | null } | null;
  exams: { title: string; passing_score: number | null; is_certification: boolean } | null;
};

type ExamQuestionRow = {
  position: number;
  points_override: number | null;
  question_bank: {
    id: string;
    type: string;
    prompt: string;
    points: number;
    correct_answer: string | null;
    accepted_answers: string[] | null;
    media_path: string | null;
    media_type: string | null;
  } | null;
};

type AnswerRow = {
  id: string;
  question_id: string;
  response: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  feedback: string | null;
};

export default async function GradeAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase } = await requireStaff();
  // Regular signed-in client, not the admin one: speaking-answers'
  // storage RLS is what actually decides "can THIS teacher hear THIS
  // student's recording" (own-class teacher or admin, never every
  // teacher) - see speaking_answers_teacher_select. If this call is
  // denied, createSignedUrl returns null and the audio player just
  // doesn't render, rather than throwing.

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, status, total_score, is_late, auto_submitted, profiles(full_name), exams(title, passing_score, is_certification)")
    .eq("id", attemptId)
    .single<AttemptRow>();

  if (!attempt) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Attempt not found.</p>
      </div>
    );
  }

  const { data: examQuestions } = await supabase
    .from("exam_questions")
    .select(
      "position, points_override, question_bank(id, type, prompt, points, correct_answer, accepted_answers, media_path, media_type)"
    )
    .eq("exam_id", attempt.exam_id)
    .order("position")
    .returns<ExamQuestionRow[]>();

  const { data: answers } = await supabase
    .from("answers")
    .select("id, question_id, response, is_correct, points_awarded, feedback")
    .eq("attempt_id", attemptId)
    .returns<AnswerRow[]>();

  const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/exams/grading" className="text-sm text-accent hover:underline">
          ← Back to grading queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {attempt.profiles?.full_name ?? "Unknown student"} — {attempt.exams?.title}
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{attempt.total_score ?? 0} pts total</span>
          <Badge variant={attempt.status === "final" ? "default" : "secondary"}>
            {attempt.status === "final" ? "Final" : "Provisional"}
          </Badge>
          {attempt.is_late && <Badge variant="secondary">Late</Badge>}
          {attempt.auto_submitted && <Badge variant="secondary">Auto-submitted</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {(examQuestions ?? []).map((eq, i) => {
          const qb = eq.question_bank;
          if (!qb) return null;
          const ans = answerByQuestion.get(qb.id);
          const maxPoints = eq.points_override ?? qb.points;
          const auto = isAutoGraded(qb.type);

          return (
            <Card key={qb.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>#{i + 1}</span>
                  {auto && ans?.is_correct === true && <Badge>Auto: correct</Badge>}
                  {auto && ans?.is_correct === false && <Badge variant="destructive">Auto: incorrect</Badge>}
                  {!auto && <Badge variant="secondary">Manual grade</Badge>}
                </CardTitle>
                <CardDescription>{qb.prompt}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {qb.media_path && <QuestionMedia path={qb.media_path} isAudio={qb.media_type?.startsWith("audio/") ?? false} />}

                {qb.type === "speaking" && ans?.response ? (
                  <SpeakingAnswerAudio path={ans.response} />
                ) : (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Response: </span>
                    {ans?.response ?? <em>no answer</em>}
                  </p>
                )}

                {auto && (
                  <p className="text-xs text-muted-foreground">
                    Correct answer: {qb.type === "short_answer" ? (qb.accepted_answers ?? []).join(" / ") : qb.correct_answer}
                  </p>
                )}

                {ans ? (
                  <GradeAnswerForm
                    attemptId={attemptId}
                    answerId={ans.id}
                    maxPoints={maxPoints}
                    defaultPoints={ans.points_awarded}
                    defaultFeedback={ans.feedback}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No answer record yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

async function QuestionMedia({ path, isAudio }: { path: string; isAudio: boolean }) {
  const url = await createSignedUrl("exam-media", path);
  if (!url) return null;
  return isAudio ? (
    <audio controls src={url} className="h-9 w-full max-w-sm" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Question media" className="max-h-48 rounded-md border border-border" />
  );
}

async function SpeakingAnswerAudio({ path }: { path: string }) {
  const url = await createSignedUrl("speaking-answers", path);
  if (!url) {
    return <p className="text-sm text-destructive">Recording unavailable (not your class).</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">Response:</span>
      <audio controls src={url} className="h-9 w-full max-w-sm" />
    </div>
  );
}
