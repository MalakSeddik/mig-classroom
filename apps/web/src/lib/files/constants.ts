// Shared rules for both the submissions and materials buckets: pdf,
// doc/docx, common images, and audio (mp3/m4a/wav) for speaking
// practice, capped at ~20MB per file. Enforced both client-side (fast
// feedback, better UX) and server-side in the Server Actions (the real
// boundary - never trust the client alone).

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);

// Browsers are inconsistent about the `type` they report for some of
// these (especially audio), so also allow-list by extension as a
// fallback check.
export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp3",
  "m4a",
  "wav",
]);

export const ACCEPT_ATTRIBUTE =
  ".pdf,.doc,.docx,image/jpeg,image/png,image/gif,image/webp,.mp3,.m4a,.wav";

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav"]);

export function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedFile(file: { type: string; name: string }): boolean {
  const ext = getExtension(file.name);
  return ALLOWED_MIME_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(ext);
}

export function isAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.has(getExtension(fileName));
}

/** Safe to use as a Storage object path segment: keeps the extension,
 * replaces everything else risky with underscores. */
export function sanitizeFilename(fileName: string): string {
  const ext = getExtension(fileName);
  const base = fileName.slice(0, fileName.length - (ext ? ext.length + 1 : 0));
  const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 100) || "file";
  return ext ? `${safeBase}.${ext}` : safeBase;
}

// Exam question media (audio clips for listening, or images) - no
// pdf/doc here, just audio + image.
export const EXAM_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
]);

export const EXAM_MEDIA_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp3",
  "m4a",
  "wav",
]);

export const EXAM_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,.mp3,.m4a,.wav";

export function isAllowedExamMediaFile(file: { type: string; name: string }): boolean {
  const ext = getExtension(file.name);
  return EXAM_MEDIA_MIME_TYPES.has(file.type) || EXAM_MEDIA_EXTENSIONS.has(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Speaking-answer recordings from <AudioRecorder> (MediaRecorder output),
// not arbitrary user-picked files - so this is a looser check than
// isAllowedFile()/isAllowedExamMediaFile() above (just size + a generic
// "audio/*" type check) rather than a strict mime/extension allowlist.
export const MAX_RECORDING_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export function isAllowedRecording(file: { type: string; size: number }): boolean {
  return file.size > 0 && file.size <= MAX_RECORDING_SIZE_BYTES && file.type.startsWith("audio/");
}
