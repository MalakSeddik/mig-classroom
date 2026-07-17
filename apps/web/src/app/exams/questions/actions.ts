"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAutoGraded } from "@/lib/exams/constants";
import {
  MAX_FILE_SIZE_BYTES,
  isAllowedExamMediaFile,
  sanitizeFilename,
  formatFileSize,
} from "@/lib/files/constants";

export type QuestionFormState = {
  error: string | null;
};

type ParsedQuestion = {
  level: string;
  type: string;
  prompt: string;
  points: number;
  options: string[] | null;
  correctAnswer: string | null;
};

function parseQuestionForm(formData: FormData): ParsedQuestion {
  const level = formData.get("level") as string;
  const type = formData.get("type") as string;
  const prompt = ((formData.get("prompt") as string) || "").trim();
  const points = Number(formData.get("points"));

  let options: string[] | null = null;
  let correctAnswer: string | null = null;

  if (type === "multiple_choice") {
    const rawOptions = formData
      .getAll("options")
      .map((o) => (o as string).trim())
      .filter(Boolean);
    options = rawOptions;
    const correctIndex = formData.get("correctOption");
    if (correctIndex !== null && rawOptions[Number(correctIndex)]) {
      correctAnswer = rawOptions[Number(correctIndex)];
    }
  } else if (type === "true_false") {
    correctAnswer = (formData.get("correctAnswerBoolean") as string) || null;
  } else if (type === "short_answer") {
    correctAnswer = ((formData.get("correctAnswerText") as string) || "").trim() || null;
  }

  // Belt and suspenders: writing/speaking (and anything unrecognized)
  // never get an options/correct_answer value, regardless of what a
  // tampered request might include.
  if (!isAutoGraded(type)) {
    options = null;
    correctAnswer = null;
  }

  return { level, type, prompt, points, options, correctAnswer };
}

function validateQuestion(q: ParsedQuestion): string | null {
  if (!q.prompt) return "Prompt is required.";
  if (!Number.isFinite(q.points) || q.points < 0) return "Points must be a non-negative number.";
  if (q.type === "multiple_choice") {
    if (!q.options || q.options.length < 2) return "Multiple choice needs at least 2 options.";
    if (!q.correctAnswer) return "Select which option is correct.";
  }
  if (q.type === "true_false" && q.correctAnswer !== "true" && q.correctAnswer !== "false") {
    return "Select True or False.";
  }
  if (q.type === "short_answer" && !q.correctAnswer) {
    return "The correct answer is required for short answer questions.";
  }
  return null;
}

async function validateMedia(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Media too large - max ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`;
  }
  if (!isAllowedExamMediaFile(file)) {
    return "Unsupported media type - use an image or an audio file.";
  }
  return null;
}

export async function createQuestion(
  _prevState: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const parsed = parseQuestionForm(formData);
  const validationError = validateQuestion(parsed);
  if (validationError) return { error: validationError };

  const mediaFile = formData.get("media") as File | null;
  const mediaError = await validateMedia(mediaFile);
  if (mediaError) return { error: mediaError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: inserted, error } = await supabase
    .from("question_bank")
    .insert({
      level: parsed.level,
      type: parsed.type,
      prompt: parsed.prompt,
      points: parsed.points,
      options: parsed.options,
      correct_answer: parsed.correctAnswer,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (mediaFile && mediaFile.size > 0) {
    const path = `${inserted.id}/${sanitizeFilename(mediaFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("exam-media")
      .upload(path, mediaFile);

    if (uploadError) {
      // Roll back the question row rather than leave a medialess
      // question with a confusing error - keeps a create attempt
      // all-or-nothing.
      await supabase.from("question_bank").delete().eq("id", inserted.id);
      return { error: uploadError.message };
    }

    await supabase
      .from("question_bank")
      .update({ media_path: path, media_type: mediaFile.type })
      .eq("id", inserted.id);
  }

  revalidatePath("/exams/questions");
  redirect("/exams/questions");
}

export async function updateQuestion(
  questionId: string,
  _prevState: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const parsed = parseQuestionForm(formData);
  const validationError = validateQuestion(parsed);
  if (validationError) return { error: validationError };

  const mediaFile = formData.get("media") as File | null;
  const mediaError = await validateMedia(mediaFile);
  if (mediaError) return { error: mediaError };

  const removeMedia = formData.get("removeMedia") === "on";

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("question_bank")
    .select("media_path, media_type")
    .eq("id", questionId)
    .single();

  let mediaPath = existing?.media_path ?? null;
  let mediaType = existing?.media_type ?? null;

  if (mediaFile && mediaFile.size > 0) {
    if (existing?.media_path) {
      await supabase.storage.from("exam-media").remove([existing.media_path]);
    }
    const path = `${questionId}/${sanitizeFilename(mediaFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("exam-media")
      .upload(path, mediaFile, { upsert: true });
    if (uploadError) return { error: uploadError.message };
    mediaPath = path;
    mediaType = mediaFile.type;
  } else if (removeMedia && existing?.media_path) {
    await supabase.storage.from("exam-media").remove([existing.media_path]);
    mediaPath = null;
    mediaType = null;
  }

  const { error } = await supabase
    .from("question_bank")
    .update({
      level: parsed.level,
      type: parsed.type,
      prompt: parsed.prompt,
      points: parsed.points,
      options: parsed.options,
      correct_answer: parsed.correctAnswer,
      media_path: mediaPath,
      media_type: mediaType,
    })
    .eq("id", questionId);

  if (error) return { error: error.message };

  revalidatePath("/exams/questions");
  redirect("/exams/questions");
}

export async function deleteQuestion(questionId: string, mediaPath: string | null) {
  const supabase = await createClient();

  // answers.question_id is ON DELETE RESTRICT - if this question has
  // real answers against it, the delete fails and we just let that
  // surface (it's a rare, deliberate protection from Step 2).
  const { error } = await supabase.from("question_bank").delete().eq("id", questionId);

  if (!error && mediaPath) {
    await supabase.storage.from("exam-media").remove([mediaPath]);
  }

  revalidatePath("/exams/questions");
}
