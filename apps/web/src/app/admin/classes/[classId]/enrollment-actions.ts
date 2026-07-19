"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

// enrollments_insert/delete RLS (admin or teaches_class(class_id)) was
// independently verified correct. Adding the same explicit admin check
// as the other /admin actions anyway, for consistency: this whole
// section has no legitimate non-admin caller, so every mutation in it
// checks the same way rather than some relying on RLS alone and others
// not. The "available to add" list on the class page already excludes
// already-enrolled students, so duplicates shouldn't normally reach here
// at all - the unique (class_id, student_id) constraint is just the
// backstop if a race ever slips through.
export async function addEnrollment(classId: string, studentId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const adminError = await assertAdmin(supabase, user.id);
  if (adminError) return { error: adminError };

  const { error } = await supabase.from("enrollments").insert({ class_id: classId, student_id: studentId });
  if (error) {
    if (error.code === "23505") return { error: "That student is already enrolled." };
    return { error: error.message };
  }

  revalidatePath(`/admin/classes/${classId}`);
  return { error: null };
}

// Plain one-click form action (matches removeMaterial/deleteQuestion's
// existing "instant, no confirmation, no error UI" convention for
// low-risk removes) - returns void, not {error}, since a <form action>
// must resolve to void.
export async function removeEnrollment(classId: string, enrollmentId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (await assertAdmin(supabase, user.id)) return;

  await supabase.from("enrollments").delete().eq("id", enrollmentId);

  revalidatePath(`/admin/classes/${classId}`);
}
