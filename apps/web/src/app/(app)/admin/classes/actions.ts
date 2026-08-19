"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export type ClassFormState = {
  error: string | null;
};

type ParsedClass = {
  name: string;
  courseId: string;
  teacherId: string | null;
  startDate: string | null;
  endDate: string | null;
};

function parseClassForm(formData: FormData): ParsedClass {
  return {
    name: ((formData.get("name") as string) || "").trim(),
    courseId: (formData.get("courseId") as string) || "",
    teacherId: (formData.get("teacherId") as string) || null,
    startDate: (formData.get("startDate") as string) || null,
    endDate: (formData.get("endDate") as string) || null,
  };
}

function validateClass(c: ParsedClass): string | null {
  if (!c.name) return "Name is required.";
  if (!c.courseId) return "Select a course.";
  if (c.startDate && c.endDate && c.endDate < c.startDate) {
    return "End date must be on or after the start date.";
  }
  return null;
}

// Explicit code-level admin check on every mutation here, alongside RLS
// (belt and suspenders - RLS was independently verified correct, see
// assert-admin.ts). updateClass is deliberately admin-only in code even
// though classes_update also permits a class's own teacher - this
// /admin surface has no legitimate non-admin caller, so it's held to the
// stricter rule regardless of what RLS additionally allows elsewhere.
export async function createClass(
  _prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const parsed = parseClassForm(formData);
  const validationError = validateClass(parsed);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { error } = await supabase.from("classes").insert({
    name: parsed.name,
    course_id: parsed.courseId,
    teacher_id: parsed.teacherId,
    start_date: parsed.startDate,
    end_date: parsed.endDate,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/classes");
  redirect("/admin/classes");
}

export async function updateClass(
  classId: string,
  _prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const parsed = parseClassForm(formData);
  const validationError = validateClass(parsed);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { error } = await supabase
    .from("classes")
    .update({
      name: parsed.name,
      course_id: parsed.courseId,
      teacher_id: parsed.teacherId,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
    })
    .eq("id", classId);
  if (error) return { error: error.message };

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${classId}`);
  redirect("/admin/classes");
}

export async function deleteClass(classId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  // enrollments/assignments/class_sessions cascade-delete with the class;
  // exams.class_id is on delete set null (a class's exams survive as
  // standalone exams, not deleted). The confirmation dialog is what makes
  // this deliberate.
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { error: error.message };

  revalidatePath("/admin/classes");
  return { error: null };
}
