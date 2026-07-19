import "server-only";
import { createClient } from "./server";

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Generates a short-lived signed URL for a private Storage object, using
 * the regular signed-in client - createSignedUrl only succeeds if the
 * caller can SELECT that object under storage.objects' RLS policies, so
 * this leans on the same bucket policies rather than re-checking who's
 * allowed to see the file.
 */
export async function createSignedUrl(
  bucket: "submissions" | "materials" | "exam-media" | "speaking-answers",
  path: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return null;
  }
  return data.signedUrl;
}
