"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addQuestionToExam(examId: string, questionId: string) {
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("exam_questions")
    .select("position")
    .eq("exam_id", examId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (maxRow?.position ?? 0) + 1;

  await supabase
    .from("exam_questions")
    .insert({ exam_id: examId, question_id: questionId, position: nextPosition });

  revalidatePath(`/exams/${examId}`);
}

export async function removeQuestionFromExam(examId: string, examQuestionId: string) {
  const supabase = await createClient();
  await supabase.from("exam_questions").delete().eq("id", examQuestionId);
  revalidatePath(`/exams/${examId}`);
}

export async function moveQuestion(
  examId: string,
  examQuestionId: string,
  direction: "up" | "down"
) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("exam_questions")
    .select("id, position")
    .eq("exam_id", examId)
    .order("position");

  if (!rows) return;

  const index = rows.findIndex((r) => r.id === examQuestionId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return; // already at the edge

  const current = rows[index];
  const swapWith = rows[swapIndex];

  // Three-step swap avoids ever violating the unique(exam_id, position)
  // constraint mid-transaction - -1 is never a real position.
  await supabase.from("exam_questions").update({ position: -1 }).eq("id", current.id);
  await supabase
    .from("exam_questions")
    .update({ position: current.position })
    .eq("id", swapWith.id);
  await supabase
    .from("exam_questions")
    .update({ position: swapWith.position })
    .eq("id", current.id);

  revalidatePath(`/exams/${examId}`);
}

export async function updatePointsOverride(
  examId: string,
  examQuestionId: string,
  formData: FormData
) {
  const raw = (formData.get("pointsOverride") as string) ?? "";
  const value = raw.trim() === "" ? null : Number(raw);

  const supabase = await createClient();
  await supabase
    .from("exam_questions")
    .update({ points_override: value })
    .eq("id", examQuestionId);

  revalidatePath(`/exams/${examId}`);
}
