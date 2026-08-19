"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateSessionState = {
  error: string | null;
};

export async function createSession(
  classId: string,
  _prevState: CreateSessionState,
  formData: FormData
): Promise<CreateSessionState> {
  const sessionDate = formData.get("sessionDate") as string;
  const topic = formData.get("topic") as string;

  if (!sessionDate) {
    return { error: "Session date is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // No role check here - class_sessions_insert (admin or teaches_class)
  // handles that, same convention as createAssignment.
  const { error } = await supabase.from("class_sessions").insert({
    class_id: classId,
    session_date: sessionDate,
    topic: topic || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}/attendance`);
  return { error: null };
}

export type SaveAttendanceState = {
  error: string | null;
};

export async function saveAttendance(
  classId: string,
  sessionId: string,
  _prevState: SaveAttendanceState,
  formData: FormData
): Promise<SaveAttendanceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // The roster comes from the DB, not the submitted form, so a missing
  // or tampered field can't silently skip a student or attribute a
  // status to someone who isn't actually enrolled.
  const { data: roster } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("class_id", classId);

  if (!roster || roster.length === 0) {
    return { error: "No enrolled students to record attendance for." };
  }

  const rows = roster.map((r) => ({
    session_id: sessionId,
    student_id: r.student_id,
    status: (formData.get(`status-${r.student_id}`) as string) || "present",
  }));

  // One upsert covers both a brand-new session and editing a past one's
  // attendance - attendance_session_student_unique is exactly the
  // conflict target, same "insert or update, whichever applies" shape
  // used for grades/exam answers elsewhere in this app.
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "session_id,student_id" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}/attendance/${sessionId}`);
  revalidatePath(`/classes/${classId}/attendance`);
  return { error: null };
}
