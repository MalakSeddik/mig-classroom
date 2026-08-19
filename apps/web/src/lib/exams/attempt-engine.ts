"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSignedUrlAdmin } from "@/lib/supabase/signed-url-admin";
import { isAutoGraded, normalizeAnswerText } from "@/lib/exams/constants";

// Network-latency tolerance on top of duration_minutes before a
// submission (or a resume-time check) counts as late. Not a loophole -
// see the "never discard, always flag" policy below.
const SUBMIT_GRACE_SECONDS = 60;

export type SafeQuestion = {
  id: string;
  type: string;
  prompt: string;
  points: number;
  options: string[] | null;
  mediaUrl: string | null;
  mediaType: string | null;
};

export type StartAttemptResult =
  | { kind: "error"; message: string }
  | { kind: "not-assigned" }
  | { kind: "not-open"; reason: "not-open-yet" | "closed"; opensAt: string | null; closesAt: string | null }
  | { kind: "already-completed"; attemptId: string }
  | {
      kind: "active";
      attempt: { id: string; startedAt: string; durationMinutes: number };
      questions: SafeQuestion[];
      existingAnswers: Record<string, string>;
    };

type ResolvedAssignment = { id: string; exam_id: string; starts_at: string | null; ends_at: string | null };

function windowStatus(a: { starts_at: string | null; ends_at: string | null }, now: number) {
  const startsAtMs = a.starts_at ? new Date(a.starts_at).getTime() : null;
  const endsAtMs = a.ends_at ? new Date(a.ends_at).getTime() : null;
  if (startsAtMs !== null && now < startsAtMs) return "upcoming" as const;
  if (endsAtMs !== null && now > endsAtMs) return "closed" as const;
  return "open" as const;
}

type EligibilityResult =
  | { kind: "error"; message: string }
  | { kind: "not-assigned" }
  | { kind: "not-open"; reason: "not-open-yet" | "closed"; opensAt: string | null; closesAt: string | null }
  | { kind: "eligible"; durationMinutes: number };

/**
 * Shared by getExamStartInfo (read-only preview, used to gate on a mic
 * check before the clock starts) and startOrResumeAttempt (the real
 * thing) - assignment + window checks only, no attempt row is touched
 * here either way.
 */
async function resolveEligibility(
  examId: string,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<EligibilityResult> {
  const { data: myAssignments } = await admin
    .from("exam_assignment_students")
    .select("exam_assignments(id, exam_id, starts_at, ends_at)")
    .eq("student_id", userId)
    .returns<{ exam_assignments: ResolvedAssignment | null }[]>();

  const relevant = (myAssignments ?? [])
    .map((r) => r.exam_assignments)
    .filter((a): a is ResolvedAssignment => a !== null && a.exam_id === examId);

  if (relevant.length === 0) {
    return { kind: "not-assigned" };
  }

  const now = Date.now();
  const openAssignment = relevant.find((a) => windowStatus(a, now) === "open");

  if (!openAssignment) {
    const upcoming = relevant
      .filter((a) => windowStatus(a, now) === "upcoming")
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];

    if (upcoming) {
      return { kind: "not-open", reason: "not-open-yet", opensAt: upcoming.starts_at, closesAt: upcoming.ends_at };
    }

    const mostRecentlyClosed = [...relevant].sort(
      (a, b) => new Date(b.ends_at ?? 0).getTime() - new Date(a.ends_at ?? 0).getTime()
    )[0];
    return { kind: "not-open", reason: "closed", opensAt: mostRecentlyClosed.starts_at, closesAt: mostRecentlyClosed.ends_at };
  }

  const { data: exam } = await admin
    .from("exams")
    .select("id, duration_minutes")
    .eq("id", examId)
    .single<{ id: string; duration_minutes: number }>();
  if (!exam) return { kind: "not-assigned" };

  return { kind: "eligible", durationMinutes: exam.duration_minutes };
}

export type ExamStartInfo =
  | { kind: "error"; message: string }
  | { kind: "not-assigned" }
  | { kind: "not-open"; reason: "not-open-yet" | "closed"; opensAt: string | null; closesAt: string | null }
  | { kind: "already-completed"; attemptId: string }
  | { kind: "resume" }
  | { kind: "ready"; examTitle: string; durationMinutes: number; hasSpeaking: boolean };

/**
 * Read-only preview of "what would happen if this student tried to start
 * examId right now" - same eligibility rules as startOrResumeAttempt, but
 * never creates an exam_attempts row, so it never starts the clock.
 * Exists specifically so the take-exam page can find out whether this
 * exam contains a speaking question (and warn + require a mic check)
 * *before* committing to starting the timed attempt. If an attempt is
 * already in_progress, the clock is already running regardless, so this
 * returns "resume" and the page skips the gate entirely.
 */
export async function getExamStartInfo(examId: string): Promise<ExamStartInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "error", message: "You must be signed in." };

  const admin = createAdminClient();
  const eligibility = await resolveEligibility(examId, user.id, admin);
  if (eligibility.kind !== "eligible") return eligibility;

  const { data: existingAttempt } = await admin
    .from("exam_attempts")
    .select("id, status")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle<{ id: string; status: string }>();

  if (existingAttempt) {
    if (existingAttempt.status !== "in_progress") {
      return { kind: "already-completed", attemptId: existingAttempt.id };
    }
    return { kind: "resume" };
  }

  const { data: exam } = await admin.from("exams").select("title").eq("id", examId).single<{ title: string }>();

  const { data: examQuestions } = await admin
    .from("exam_questions")
    .select("question_bank(type)")
    .eq("exam_id", examId)
    .returns<{ question_bank: { type: string } | null }[]>();

  const hasSpeaking = (examQuestions ?? []).some((eq) => eq.question_bank?.type === "speaking");

  return {
    kind: "ready",
    examTitle: exam?.title ?? "",
    durationMinutes: eligibility.durationMinutes,
    hasSpeaking,
  };
}

/**
 * Eligibility + window + one-attempt-only + question delivery, all in one
 * place. Runs entirely on the admin (service_role) client after
 * independently verifying the caller via getUser() - this is the
 * "tightly scoped to an already-verified user" case admin.ts's own doc
 * comment describes. question_bank's correct_answer/accepted_answers
 * columns are never selected by the query below in the first place, so
 * there's nothing to accidentally leak into the sanitized payload.
 */
export async function startOrResumeAttempt(examId: string): Promise<StartAttemptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "error", message: "You must be signed in." };

  const admin = createAdminClient();

  const eligibility = await resolveEligibility(examId, user.id, admin);
  if (eligibility.kind !== "eligible") return eligibility;
  const durationMinutes = eligibility.durationMinutes;

  const { data: existingAttempt } = await admin
    .from("exam_attempts")
    .select("id, started_at, status")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle<{ id: string; started_at: string; status: string }>();

  let attemptId: string;
  let startedAt: string;

  if (existingAttempt) {
    if (existingAttempt.status !== "in_progress") {
      return { kind: "already-completed", attemptId: existingAttempt.id };
    }

    const elapsedSeconds = (Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000;
    if (elapsedSeconds > durationMinutes * 60 + SUBMIT_GRACE_SECONDS) {
      // The student let the clock run out without ever submitting -
      // finalize it now, on this read, rather than leaving it stuck
      // in_progress forever. See finalizeExpiredIfNeeded for the other
      // half of this "finalize on read" mechanism.
      await finalizeAttempt(existingAttempt.id, { autoSubmitted: true });
      return { kind: "already-completed", attemptId: existingAttempt.id };
    }

    attemptId = existingAttempt.id;
    startedAt = existingAttempt.started_at;
  } else {
    const { data: inserted, error } = await admin
      .from("exam_attempts")
      .insert({ exam_id: examId, student_id: user.id })
      .select("id, started_at")
      .single<{ id: string; started_at: string }>();
    if (error || !inserted) return { kind: "error", message: error?.message ?? "Could not start the attempt." };
    attemptId = inserted.id;
    startedAt = inserted.started_at;
  }

  type ExamQuestionEmbed = {
    id: string;
    position: number;
    points_override: number | null;
    question_bank: {
      id: string;
      type: string;
      prompt: string;
      points: number;
      options: string[] | null;
      media_path: string | null;
      media_type: string | null;
    } | null;
  };

  const { data: examQuestions } = await admin
    .from("exam_questions")
    .select("id, position, points_override, question_bank(id, type, prompt, points, options, media_path, media_type)")
    .eq("exam_id", examId)
    .order("position")
    .returns<ExamQuestionEmbed[]>();

  const questions: SafeQuestion[] = [];
  for (const eq of examQuestions ?? []) {
    const qb = eq.question_bank;
    if (!qb) continue;
    questions.push({
      id: qb.id,
      type: qb.type,
      prompt: qb.prompt,
      points: eq.points_override ?? qb.points,
      options: qb.options,
      mediaUrl: qb.media_path ? await createSignedUrlAdmin("exam-media", qb.media_path) : null,
      mediaType: qb.media_type,
    });
  }

  const { data: existingAnswerRows } = await admin
    .from("answers")
    .select("question_id, response")
    .eq("attempt_id", attemptId);

  const existingAnswers: Record<string, string> = {};
  for (const a of existingAnswerRows ?? []) {
    if (a.response !== null) existingAnswers[a.question_id] = a.response;
  }

  return {
    kind: "active",
    attempt: { id: attemptId, startedAt, durationMinutes },
    questions,
    existingAnswers,
  };
}

/**
 * Persists one answer as the student works, so a closed tab never loses
 * more than the last few seconds of typing. No grading happens here -
 * just storage; all grading happens once, in finalizeAttempt.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  response: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, student_id, status")
    .eq("id", attemptId)
    .single<{ id: string; student_id: string; status: string }>();

  if (!attempt || attempt.student_id !== user.id) return { error: "Not your attempt." };
  if (attempt.status !== "in_progress") return { error: null }; // already finalized - silently ignore, not an error

  const { error } = await admin
    .from("answers")
    .upsert({ attempt_id: attemptId, question_id: questionId, response }, { onConflict: "attempt_id,question_id" });

  return { error: error?.message ?? null };
}

/**
 * Explicit submit (button click or client-side auto-submit at time-out).
 * Upserts any last answers that might not have synced yet via saveAnswer,
 * then finalizes. finalizeAttempt itself is idempotent, so this can never
 * double-finalize even if it races a resume-detection finalize.
 */
export async function submitExam(
  attemptId: string,
  finalAnswers: { questionId: string; response: string }[]
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, student_id, status")
    .eq("id", attemptId)
    .single<{ id: string; student_id: string; status: string }>();

  if (!attempt || attempt.student_id !== user.id) return { error: "Not your attempt." };
  if (attempt.status !== "in_progress") return { error: null };

  if (finalAnswers.length > 0) {
    const rows = finalAnswers.map((a) => ({
      attempt_id: attemptId,
      question_id: a.questionId,
      response: a.response,
    }));
    const { error } = await admin.from("answers").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) return { error: error.message };
  }

  await finalizeAttempt(attemptId, { autoSubmitted: false });
  return { error: null };
}

/**
 * Grades everything saved so far and flips the attempt out of
 * in_progress. Idempotent by construction: the very first check bails
 * out unless status is still 'in_progress', so this can be called from
 * multiple races (explicit submit, client auto-submit, resume-detection,
 * the my-exams/results-page sweep) without ever double-finalizing.
 *
 * Never discards answers for being late - lateness is only ever recorded
 * as a flag (is_late / auto_submitted), matching the "never discard,
 * always flag" policy. Not exported - only reachable through the
 * functions above and finalizeExpiredIfNeeded below.
 */
async function finalizeAttempt(attemptId: string, opts: { autoSubmitted: boolean }): Promise<void> {
  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, exam_id, started_at, status")
    .eq("id", attemptId)
    .single<{ id: string; exam_id: string; started_at: string; status: string }>();
  if (!attempt || attempt.status !== "in_progress") return;

  const { data: exam } = await admin
    .from("exams")
    .select("duration_minutes")
    .eq("id", attempt.exam_id)
    .single<{ duration_minutes: number }>();
  const durationMinutes = exam?.duration_minutes ?? 0;

  const elapsedSeconds = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
  const isLate = elapsedSeconds > durationMinutes * 60 + SUBMIT_GRACE_SECONDS;

  type GradingRow = {
    question_id: string;
    points_override: number | null;
    question_bank: {
      type: string;
      correct_answer: string | null;
      accepted_answers: string[] | null;
      points: number;
    } | null;
  };

  const { data: examQuestions } = await admin
    .from("exam_questions")
    .select("question_id, points_override, question_bank(type, correct_answer, accepted_answers, points)")
    .eq("exam_id", attempt.exam_id)
    .returns<GradingRow[]>();

  const { data: existingAnswers } = await admin
    .from("answers")
    .select("id, question_id, response, points_awarded")
    .eq("attempt_id", attemptId)
    .returns<{ id: string; question_id: string; response: string | null; points_awarded: number | null }[]>();

  const answerByQuestion = new Map((existingAnswers ?? []).map((a) => [a.question_id, a]));

  let hasPendingManual = false;
  let totalScore = 0;

  for (const eq of examQuestions ?? []) {
    const qb = eq.question_bank;
    if (!qb) continue;
    const existing = answerByQuestion.get(eq.question_id);
    const response = existing?.response ?? null;
    const maxPoints = eq.points_override ?? qb.points;

    if (isAutoGraded(qb.type)) {
      let isCorrect = false;
      if (response !== null) {
        if (qb.type === "short_answer") {
          const accepted =
            qb.accepted_answers && qb.accepted_answers.length > 0
              ? qb.accepted_answers
              : qb.correct_answer
                ? [qb.correct_answer]
                : [];
          isCorrect = accepted.some((a) => normalizeAnswerText(a) === normalizeAnswerText(response));
        } else {
          isCorrect = qb.correct_answer !== null && normalizeAnswerText(qb.correct_answer) === normalizeAnswerText(response);
        }
      }
      const pointsAwarded = isCorrect ? maxPoints : 0;
      totalScore += pointsAwarded;

      if (existing) {
        await admin.from("answers").update({ is_correct: isCorrect, points_awarded: pointsAwarded }).eq("id", existing.id);
      } else {
        await admin
          .from("answers")
          .insert({ attempt_id: attemptId, question_id: eq.question_id, response: null, is_correct: isCorrect, points_awarded: pointsAwarded });
      }
    } else {
      // writing/speaking - pending until a teacher grades it. Make sure a
      // row exists (even with no response) so the grading queue can see
      // there's something pending for this attempt.
      if (!existing) {
        await admin.from("answers").insert({ attempt_id: attemptId, question_id: eq.question_id, response: null });
      }
      if (!existing || existing.points_awarded === null) {
        hasPendingManual = true;
      } else {
        totalScore += existing.points_awarded;
      }
    }
  }

  await admin
    .from("exam_attempts")
    .update({
      status: hasPendingManual ? "auto_graded" : "final",
      submitted_at: new Date().toISOString(),
      total_score: totalScore,
      is_late: isLate,
      auto_submitted: opts.autoSubmitted,
    })
    .eq("id", attemptId);
}

/**
 * The practical half of "finalize on read": called from the my-exams list
 * and results pages before rendering, so an attempt whose deadline has
 * passed never sits stuck in_progress just because nobody happened to be
 * looking at the moment it expired. There's no real scheduler wired up
 * yet (see CLAUDE.md) - this is the stand-in until one exists.
 */
export async function finalizeExpiredIfNeeded(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: inProgress } = await admin
    .from("exam_attempts")
    .select("id, started_at, exams(duration_minutes)")
    .eq("student_id", user.id)
    .eq("status", "in_progress")
    .returns<{ id: string; started_at: string; exams: { duration_minutes: number } | null }[]>();

  const now = Date.now();
  for (const a of inProgress ?? []) {
    const durationMinutes = a.exams?.duration_minutes ?? 0;
    const elapsedSeconds = (now - new Date(a.started_at).getTime()) / 1000;
    if (elapsedSeconds > durationMinutes * 60 + SUBMIT_GRACE_SECONDS) {
      await finalizeAttempt(a.id, { autoSubmitted: true });
    }
  }
}

export type AttemptBreakdownItem = {
  questionId: string;
  type: string;
  prompt: string;
  maxPoints: number;
  mediaUrl: string | null;
  mediaType: string | null;
  options: string[] | null;
  response: string | null;
  // Only set for type "speaking" with a saved response - response itself
  // is a speaking-answers storage path in that case, not readable text.
  answerAudioUrl: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  feedback: string | null;
};

export type AttemptBreakdown = {
  attempt: {
    id: string;
    status: string;
    totalScore: number | null;
    isLate: boolean;
    autoSubmitted: boolean;
    examTitle: string;
    isCertification: boolean;
    passingScore: number | null;
  };
  items: AttemptBreakdownItem[];
};

/**
 * The student's own results view: per-question breakdown with prompt and
 * their own answer, never correct_answer/accepted_answers. Ownership is
 * checked in code (student_id === caller), same as everywhere else in
 * this file - the admin client bypasses RLS so this check IS the
 * boundary, not a backstop for one.
 */
export async function getAttemptBreakdown(attemptId: string): Promise<{ error: string } | AttemptBreakdown> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();

  type AttemptRow = {
    id: string;
    exam_id: string;
    student_id: string;
    status: string;
    total_score: number | null;
    is_late: boolean;
    auto_submitted: boolean;
    exams: { title: string; is_certification: boolean; passing_score: number | null } | null;
  };

  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, exam_id, student_id, status, total_score, is_late, auto_submitted, exams(title, is_certification, passing_score)")
    .eq("id", attemptId)
    .single<AttemptRow>();

  if (!attempt || attempt.student_id !== user.id) return { error: "Attempt not found." };

  type ExamQuestionRow = {
    position: number;
    points_override: number | null;
    question_bank: {
      id: string;
      type: string;
      prompt: string;
      points: number;
      options: string[] | null;
      media_path: string | null;
      media_type: string | null;
    } | null;
  };

  const { data: examQuestions } = await admin
    .from("exam_questions")
    .select("position, points_override, question_bank(id, type, prompt, points, options, media_path, media_type)")
    .eq("exam_id", attempt.exam_id)
    .order("position")
    .returns<ExamQuestionRow[]>();

  const { data: answers } = await admin
    .from("answers")
    .select("question_id, response, is_correct, points_awarded, feedback")
    .eq("attempt_id", attemptId)
    .returns<
      { question_id: string; response: string | null; is_correct: boolean | null; points_awarded: number | null; feedback: string | null }[]
    >();

  const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));

  const items: AttemptBreakdownItem[] = [];
  for (const eq of examQuestions ?? []) {
    const qb = eq.question_bank;
    if (!qb) continue;
    const ans = answerByQuestion.get(qb.id);
    items.push({
      questionId: qb.id,
      type: qb.type,
      prompt: qb.prompt,
      maxPoints: eq.points_override ?? qb.points,
      mediaUrl: qb.media_path ? await createSignedUrlAdmin("exam-media", qb.media_path) : null,
      mediaType: qb.media_type,
      options: qb.options,
      response: ans?.response ?? null,
      answerAudioUrl:
        qb.type === "speaking" && ans?.response ? await createSignedUrlAdmin("speaking-answers", ans.response) : null,
      isCorrect: ans?.is_correct ?? null,
      pointsAwarded: ans?.points_awarded ?? null,
      feedback: ans?.feedback ?? null,
    });
  }

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      totalScore: attempt.total_score,
      isLate: attempt.is_late,
      autoSubmitted: attempt.auto_submitted,
      examTitle: attempt.exams?.title ?? "",
      isCertification: attempt.exams?.is_certification ?? false,
      passingScore: attempt.exams?.passing_score ?? null,
    },
    items,
  };
}

export type MyExamSummary = {
  attemptId: string;
  examId: string;
  examTitle: string;
  classId: string | null;
  className: string | null;
  isCertification: boolean;
  status: string;
  totalScore: number | null;
  maxScore: number;
};

/**
 * Lightweight per-attempt summary for the student's own grades overview
 * (/grades) - deliberately leaner than getAttemptBreakdown: no per-
 * question prompts, options, or media/signed URLs, since the overview
 * only needs one number (max possible points) per exam. Only ever
 * returns this student's own finalized attempts (auto_graded or final) -
 * an in_progress attempt has no meaningful score yet, so it's excluded
 * rather than shown as zero, same "never invent a zero" rule the rest of
 * this page follows.
 *
 * Uses the admin client to sum exam_questions/question_bank.points,
 * since students have zero RLS grant on either table (by design - see
 * "Delivery: how correct_answer stays off the wire" in CLAUDE.md). Safe
 * despite the bypass: the query only ever selects the `points` column,
 * never prompt/options/correct_answer/accepted_answers, and only for
 * exam_ids drawn from this caller's own attempts - never exposing a
 * total for an exam the student hasn't taken.
 */
export async function getMyExamSummaries(): Promise<MyExamSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();

  type AttemptRow = {
    id: string;
    exam_id: string;
    status: string;
    total_score: number | null;
    exams: {
      title: string;
      class_id: string | null;
      is_certification: boolean;
      classes: { name: string } | null;
    } | null;
  };

  const { data: attempts } = await admin
    .from("exam_attempts")
    .select("id, exam_id, status, total_score, exams(title, class_id, is_certification, classes(name))")
    .eq("student_id", user.id)
    .in("status", ["auto_graded", "final"])
    .returns<AttemptRow[]>();

  if (!attempts || attempts.length === 0) return [];

  const examIds = [...new Set(attempts.map((a) => a.exam_id))];

  const { data: examQuestions } = await admin
    .from("exam_questions")
    .select("exam_id, points_override, question_bank(points)")
    .in("exam_id", examIds)
    .returns<{ exam_id: string; points_override: number | null; question_bank: { points: number } | null }[]>();

  const maxByExam = new Map<string, number>();
  for (const eq of examQuestions ?? []) {
    const pts = eq.points_override ?? eq.question_bank?.points ?? 0;
    maxByExam.set(eq.exam_id, (maxByExam.get(eq.exam_id) ?? 0) + pts);
  }

  return attempts.map((a) => ({
    attemptId: a.id,
    examId: a.exam_id,
    examTitle: a.exams?.title ?? "",
    classId: a.exams?.class_id ?? null,
    className: a.exams?.classes?.name ?? null,
    isCertification: a.exams?.is_certification ?? false,
    status: a.status,
    totalScore: a.total_score,
    maxScore: maxByExam.get(a.exam_id) ?? 0,
  }));
}
