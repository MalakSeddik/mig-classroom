import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradeForm } from "./grade-form";
import { FileAttachment } from "@/components/file-attachment";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Profile = { role: "student" | "teacher" | "admin" };

type SubmissionRow = {
  id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  submitted_at: string | null;
  profiles: { full_name: string | null } | null;
  assignments: {
    title: string;
    max_points: number;
    classes: { teacher_id: string | null } | null;
  } | null;
  // grades.submission_id is unique, so PostgREST embeds this as a single
  // object rather than an array.
  grades: { id: string; points: number; feedback: string | null } | null;
};

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string; submissionId: string }>;
}) {
  const { classId, assignmentId, submissionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Profile>();

  // submissions_select's RLS scopes this to the owning student, the
  // class's teacher, or an admin.
  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, content, file_path, file_name, submitted_at, profiles(full_name), assignments(title, max_points, classes(teacher_id)), grades(id, points, feedback)"
    )
    .eq("id", submissionId)
    .single<SubmissionRow>();

  if (!submission) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          Submission not found, or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  const isStaffView =
    submission.assignments?.classes?.teacher_id === user.id ||
    profile?.role === "admin";

  // This page is for grading - a student viewing their own submission
  // already sees it (read-only, with any grade) on the assignment page
  // itself, so send them back there instead of a form they can't use.
  if (!isStaffView) {
    redirect(`/classes/${classId}/assignments/${assignmentId}`);
  }

  const grade = submission.grades;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link
          href={`/classes/${classId}/assignments/${assignmentId}`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to submissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {submission.profiles?.full_name ?? "Unknown student"}
        </h1>
        <p className="text-muted-foreground">{submission.assignments?.title}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission</CardTitle>
          <CardDescription>
            {submission.submitted_at
              ? `Submitted ${new Date(submission.submitted_at).toLocaleString()}`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {submission.content && (
            <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
              {submission.content}
            </p>
          )}
          {submission.file_path && submission.file_name && (
            <FileAttachment
              bucket="submissions"
              path={submission.file_path}
              fileName={submission.file_name}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade</CardTitle>
        </CardHeader>
        <CardContent>
          <GradeForm
            classId={classId}
            assignmentId={assignmentId}
            submissionId={submissionId}
            maxPoints={submission.assignments?.max_points ?? 100}
            defaultPoints={grade?.points}
            defaultFeedback={grade?.feedback}
          />
        </CardContent>
      </Card>
    </div>
  );
}
