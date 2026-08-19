import "server-only";
import { createAdminClient } from "./admin";

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Same shape as createSignedUrl() in signed-url.ts, but built on the
 * admin (service_role) client instead of the caller's own. Needed
 * specifically for delivering exam-media to a student mid-attempt: that
 * bucket's storage RLS is still 100% staff-only (see the exam_media_
 * staff_all policy), so a student's own client would correctly be denied.
 *
 * Only call this from code that has already independently verified the
 * caller is allowed to see this specific file (e.g. attempt-engine.ts,
 * which checks the question belongs to the student's own in-progress or
 * completed attempt before ever reaching this function) - unlike the
 * regular createSignedUrl, there's no RLS check backing this one up.
 *
 * "speaking-answers" was added alongside getAttemptBreakdown's own answer
 * playback: that function already verifies attempt.student_id === caller
 * before doing anything else, so this is the same "already-verified
 * caller" case, just for the student's own recording instead of exam
 * media. The teacher-facing grading view deliberately does NOT use this -
 * it goes through the real speaking_answers_teacher_select RLS policy
 * instead, since "which teacher can see which class's recordings" is
 * exactly the kind of per-caller check RLS is a better fit for than an
 * admin-client bypass.
 */
export async function createSignedUrlAdmin(
  bucket: "exam-media" | "speaking-answers",
  path: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return null;
  }
  return data.signedUrl;
}
