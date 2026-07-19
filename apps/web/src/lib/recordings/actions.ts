"use server";

import { createClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/supabase/signed-url";
import { MAX_RECORDING_SIZE_BYTES, isAllowedRecording, formatFileSize } from "@/lib/files/constants";

export type UploadRecordingResult = { path: string } | { error: string };

// Extension is derived from the MIME type the browser's MediaRecorder
// reports, since a recorded Blob has no filename of its own.
function extensionForMimeType(type: string): string {
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  return "audio";
}

/**
 * Uploads a student's own recorded audio clip to the private
 * speaking-answers bucket, at {user.id}/{uuid}.{ext} - the
 * speaking_answers_own_insert storage policy only allows writes under the
 * caller's own folder, so this is a plain "own folder" case like
 * submissions, not something that needs the admin client.
 *
 * This action only uploads and returns the storage path - it has no idea
 * what the recording is *for* (an exam attempt, an assignment, etc.).
 * That linkage is the caller's job, added in a later part.
 */
export async function uploadSpeakingRecording(formData: FormData): Promise<UploadRecordingResult> {
  const file = formData.get("recording") as File | null;
  if (!file || file.size === 0) {
    return { error: "No recording provided." };
  }
  if (!isAllowedRecording(file)) {
    return { error: `Recording must be an audio file, max ${formatFileSize(MAX_RECORDING_SIZE_BYTES)}.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const path = `${user.id}/${crypto.randomUUID()}.${extensionForMimeType(file.type)}`;
  const { error } = await supabase.storage.from("speaking-answers").upload(path, file, {
    contentType: file.type,
  });

  if (error) return { error: error.message };

  return { path };
}

/**
 * Fetches a fresh signed URL for a previously-uploaded recording, so a
 * caller can confirm playback of the copy that actually made it to
 * Storage (not just the local Blob still sitting in browser memory).
 * Relies on speaking_answers_select RLS - only the owning student (or an
 * admin) can generate a URL for a given path.
 */
export async function getRecordingPlaybackUrl(path: string): Promise<string | null> {
  return createSignedUrl("speaking-answers", path);
}
