"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE_BYTES,
  isAllowedFile,
  sanitizeFilename,
  formatFileSize,
} from "@/lib/files/constants";

export type MaterialsState = {
  error: string | null;
};

export async function addMaterials(
  classId: string,
  assignmentId: string,
  _prevState: MaterialsState,
  formData: FormData
): Promise<MaterialsState> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "Choose at least one file." };
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: `"${file.name}" is too large - max ${formatFileSize(MAX_FILE_SIZE_BYTES)}.` };
    }
    if (!isAllowedFile(file)) {
      return { error: `"${file.name}" is an unsupported file type.` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // Multiple materials can share a filename (e.g. two different
  // "notes.pdf" uploaded on different days), so the storage path gets a
  // short random prefix to guarantee uniqueness - file_name keeps the
  // original name for display.
  for (const file of files) {
    const uniquePrefix = crypto.randomUUID().slice(0, 8);
    const path = `${classId}/${assignmentId}/${uniquePrefix}-${sanitizeFilename(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(path, file);

    // materials_bucket_insert_staff (RLS) requires this user to teach
    // this class or be an admin - fails here if they don't.
    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: insertError } = await supabase.from("assignment_materials").insert({
      assignment_id: assignmentId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type || null,
      uploaded_by: user.id,
    });

    if (insertError) {
      // Storage upload succeeded but the DB row failed - clean up the
      // orphaned object rather than leaving it un-tracked.
      await supabase.storage.from("materials").remove([path]);
      return { error: insertError.message };
    }
  }

  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  return { error: null };
}

export async function removeMaterial(
  classId: string,
  assignmentId: string,
  materialId: string,
  storagePath: string
) {
  const supabase = await createClient();

  // materials_delete (table RLS) and materials_bucket_delete_staff
  // (storage RLS) both gate this to the class's teacher or an admin.
  await supabase.storage.from("materials").remove([storagePath]);
  await supabase.from("assignment_materials").delete().eq("id", materialId);

  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
}
