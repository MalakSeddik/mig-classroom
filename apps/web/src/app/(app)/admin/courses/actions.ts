"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export type CourseFormState = {
  error: string | null;
};

// Explicit code-level admin check alongside RLS (belt and suspenders,
// not a patch for a real RLS gap - see lib/supabase/assert-admin.ts).
export async function createCourse(
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const title = ((formData.get("title") as string) || "").trim();
  const level = formData.get("level") as string;
  const description = ((formData.get("description") as string) || "").trim() || null;

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { error } = await supabase.from("courses").insert({ title, level, description });
  if (error) return { error: error.message };

  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function updateCourse(
  courseId: string,
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const title = ((formData.get("title") as string) || "").trim();
  const level = formData.get("level") as string;
  const description = ((formData.get("description") as string) || "").trim() || null;

  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { error } = await supabase
    .from("courses")
    .update({ title, level, description })
    .eq("id", courseId);
  if (error) return { error: error.message };

  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function deleteCourse(courseId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  // courses.classes is on delete cascade, which cascades further to
  // enrollments/assignments/sessions - a real, wide-reaching delete. The
  // confirmation dialog in the UI is what makes sure this is deliberate.
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return { error: error.message };

  revalidatePath("/admin/courses");
  return { error: null };
}
