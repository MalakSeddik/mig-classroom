"use client";

import { useEffect, useState } from "react";
import { getRecordingPlaybackUrl } from "@/lib/recordings/actions";
import { Badge } from "@/components/ui/badge";

/**
 * Client-side playback for a speaking-answers recording the current user
 * owns, fetched via the own-read storage policy (never the teacher-scoped
 * one - this is only ever used to show a student their own take). A
 * client component rather than an async server component like
 * <FileAttachment> because both call sites hold the storage path in
 * client state (an exam's existingAnswers, or a just-uploaded/resumed
 * assignment submission) - there's no server-rendered parent to hand a
 * pre-fetched signed URL down from.
 */
export function SpeakingRecordingPlayback({ path, label = "Recording saved" }: { path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecordingPlaybackUrl(path).then((result) => {
      if (!cancelled) setUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="flex flex-col gap-2">
      <Badge>{label}</Badge>
      {url && <audio controls src={url} className="h-10 w-full max-w-sm" />}
    </div>
  );
}
