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
 */
export async function createSignedUrlAdmin(
  bucket: "exam-media",
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
