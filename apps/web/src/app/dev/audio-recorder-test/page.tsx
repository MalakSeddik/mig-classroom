import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AudioRecorderTestClient } from "./test-client";

// Scratch verification harness for the standalone <AudioRecorder>
// component (Step 5 part 2, Phase A) - not a real feature page, and not
// wired into exams yet. Safe to delete once a later part mounts the
// recorder somewhere real (an exam-taking speaking question).
export default async function AudioRecorderTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-12">
      <div>
        <h1 className="text-lg font-semibold">AudioRecorder test harness</h1>
        <p className="text-sm text-muted-foreground">
          Dev-only page to verify recording, mic-check, limits, and upload before this
          component is wired into a real feature.
        </p>
      </div>
      <AudioRecorderTestClient />
    </div>
  );
}
