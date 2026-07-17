import { createSignedUrl } from "@/lib/supabase/signed-url";
import { isAudioFile } from "@/lib/files/constants";

/**
 * Renders a private Storage file as a signed link (or an inline audio
 * player for mp3/m4a/wav) - the signed URL is generated fresh on every
 * render, server-side, and expires in a few minutes. Never pass a public
 * URL around; always re-derive one from the stored path like this.
 */
export async function FileAttachment({
  bucket,
  path,
  fileName,
}: {
  bucket: "submissions" | "materials" | "exam-media";
  path: string;
  fileName: string;
}) {
  const signedUrl = await createSignedUrl(bucket, path);

  if (!signedUrl) {
    return (
      <p className="text-sm text-destructive">
        Could not generate a link for &quot;{fileName}&quot;.
      </p>
    );
  }

  if (isAudioFile(fileName)) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm">{fileName}</span>
        <audio controls src={signedUrl} className="h-10 w-full max-w-sm" />
      </div>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-accent hover:underline"
    >
      {fileName}
    </a>
  );
}
