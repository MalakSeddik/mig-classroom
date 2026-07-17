"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE_BYTES,
  isAllowedFile,
  sanitizeFilename,
  formatFileSize,
} from "@/lib/files/constants";

export type SubmitState = {
  error: string | null;
};

export async function submitAssignment(
  classId: string,
  assignmentId: string,
  _prevState: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const content = formData.get("content") as string;
  const file = formData.get("file") as File | null;
  const hasFile = file && file.size > 0;

  if (!content && !hasFile) {
    return { error: "Write an answer, attach a file, or both." };
  }

  if (hasFile) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: `File too large - max ${formatFileSize(MAX_FILE_SIZE_BYTES)}.` };
    }
    if (!isAllowedFile(file)) {
      return { error: "Unsupported file type." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // One submission per student+assignment (Step 2's schema constraint) -
  // check for an existing row so a second submit "replaces" rather than
  // conflicting.
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, file_path, file_name")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();

  let filePath = existing?.file_path ?? null;
  let fileName = existing?.file_name ?? null;

  if (hasFile) {
    // Replacing: remove the old object first so nothing orphaned is
    // left behind in the bucket, matching the new file's actual name
    // rather than silently keeping a stale one.
    if (existing?.file_path) {
      await supabase.storage.from("submissions").remove([existing.file_path]);
    }

    const path = `${classId}/${assignmentId}/${user.id}/${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(path, file, { upsert: true });

    // submissions_bucket_insert_own (RLS) requires this student to be
    // enrolled in the class - if they aren't, this fails here rather
    // than silently succeeding.
    if (uploadError) {
      return { error: uploadError.message };
    }
    filePath = path;
    fileName = file.name;
  }

  const payload = {
    assignment_id: assignmentId,
    student_id: user.id,
    content: content || null,
    file_path: filePath,
    file_name: fileName,
    submitted_at: new Date().toISOString(),
    status: "submitted",
  };

  const { error } = existing
    ? await supabase.from("submissions").update(payload).eq("id", existing.id)
    : await supabase.from("submissions").insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  return { error: null };
}
