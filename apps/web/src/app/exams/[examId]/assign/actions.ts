"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AssignFormState = {
  error: string | null;
};

// No role/ownership check here beyond "signed in" - exam_assignments_
// staff_insert (admin, or teaches_class when class_id is set) and
// exam_assignment_students_staff_insert handle that. If either insert
// isn't allowed, RLS rejects it and we surface the resulting error, same
// convention as the rest of this app's Server Actions.
// No form fields to bind here (unlike assignExamToStudents below), so
// this skips useActionState's (prevState, formData) signature entirely
// and is just called directly from a button's onClick.
export async function assignExamToClass(examId: string, classId: string): Promise<AssignFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .insert({
      exam_id: examId,
      class_id: classId,
      assigned_by: user.id,
      starts_at: null,
      ends_at: null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // classes_select's RLS already scopes this to classes this user can
  // see, so a teacher can only ever fan out to their own class's roster.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("class_id", classId);

  const rows = (enrollments ?? []).map((e) => ({
    exam_assignment_id: assignment.id,
    student_id: e.student_id,
  }));

  if (rows.length > 0) {
    const { error: fanoutError } = await supabase.from("exam_assignment_students").insert(rows);
    if (fanoutError) return { error: fanoutError.message };
  }

  revalidatePath(`/exams/${examId}/assign`);
  return { error: null };
}

export async function assignExamToStudents(
  examId: string,
  _prevState: AssignFormState,
  formData: FormData
): Promise<AssignFormState> {
  const studentIds = formData.getAll("studentIds").map(String);
  // Already converted to absolute UTC instants client-side (see
  // AssignToStudentsForm) - a datetime-local value has no timezone of
  // its own, so that conversion has to happen in the browser, where the
  // viewer's real timezone is actually known.
  const startsAt = (formData.get("startsAt") as string) || null;
  const endsAt = (formData.get("endsAt") as string) || null;

  if (studentIds.length === 0) {
    return { error: "Select at least one student." };
  }
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { error: "Closing time must be after the opening time." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .insert({
      exam_id: examId,
      class_id: null,
      assigned_by: user.id,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const rows = studentIds.map((id) => ({
    exam_assignment_id: assignment.id,
    student_id: id,
  }));

  const { error: fanoutError } = await supabase.from("exam_assignment_students").insert(rows);
  if (fanoutError) return { error: fanoutError.message };

  revalidatePath(`/exams/${examId}/assign`);
  return { error: null };
}
