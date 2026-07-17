import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitForm } from "./submit-form";
import { MaterialsUploadForm } from "./materials-upload-form";
import { removeMaterial } from "./materials-actions";
import { FileAttachment } from "@/components/file-attachment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Profile = { role: "student" | "teacher" | "admin" };

type AssignmentRow = {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  max_points: number;
  classes: { teacher_id: string | null } | null;
};

type Material = {
  id: string;
  storage_path: string;
  file_name: string;
};

// grades.submission_id is unique, so PostgREST embeds it as a single
// object (or null) rather than an array.
type SubmissionWithGrade = {
  id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  submitted_at: string | null;
  status: string;
  grades: { points: number; feedback: string | null } | null;
};

type SubmissionForStaff = {
  id: string;
  student_id: string;
  submitted_at: string | null;
  status: string;
  profiles: { full_name: string | null } | null;
  grades: { points: number } | null;
};

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string }>;
}) {
  const { classId, assignmentId } = await params;
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

  // assignments_select's RLS already scopes this to admins, the class's
  // teacher, or enrolled students.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_date, max_points, classes(teacher_id)")
    .eq("id", assignmentId)
    .single<AssignmentRow>();

  if (!assignment) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          Assignment not found, or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  const isStaffView =
    assignment.classes?.teacher_id === user.id || profile?.role === "admin";

  // assignment_materials_select's RLS scopes this to admins, the
  // assignment's class teacher, or enrolled students.
  const { data: materials } = await supabase
    .from("assignment_materials")
    .select("id, storage_path, file_name")
    .eq("assignment_id", assignmentId)
    .order("created_at")
    .returns<Material[]>();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link
          href={`/classes/${classId}`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to class
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {assignment.title}
        </h1>
        <p className="text-muted-foreground">
          {assignment.due_date
            ? `Due ${new Date(assignment.due_date).toLocaleDateString()}`
            : "No due date"}{" "}
          · {assignment.max_points} pts
        </p>
      </div>

      {assignment.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {assignment.instructions}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Materials</CardTitle>
          {!isStaffView && (
            <CardDescription>Files your teacher attached to this assignment.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {materials && materials.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <FileAttachment
                    bucket="materials"
                    path={m.storage_path}
                    fileName={m.file_name}
                  />
                  {isStaffView && (
                    <form
                      action={removeMaterial.bind(
                        null,
                        classId,
                        assignmentId,
                        m.id,
                        m.storage_path
                      )}
                    >
                      <Button type="submit" variant="outline" size="sm">
                        Remove
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No materials attached yet.
            </p>
          )}

          {isStaffView && (
            <MaterialsUploadForm classId={classId} assignmentId={assignmentId} />
          )}
        </CardContent>
      </Card>

      {isStaffView ? (
        <StaffSubmissionsList classId={classId} assignmentId={assignmentId} />
      ) : (
        <StudentSubmission classId={classId} assignmentId={assignmentId} />
      )}
    </div>
  );
}

async function StaffSubmissionsList({
  classId,
  assignmentId,
}: {
  classId: string;
  assignmentId: string;
}) {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, student_id, submitted_at, status, profiles(full_name), grades(points)")
    .eq("assignment_id", assignmentId)
    .order("submitted_at")
    .returns<SubmissionForStaff[]>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
        <CardDescription>
          {submissions?.length ?? 0} submitted so far.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submissions && submissions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => {
              const graded = !!s.grades;
              return (
                <li key={s.id}>
                  <Link
                    href={`/classes/${classId}/assignments/${assignmentId}/submissions/${s.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                  >
                    <span>{s.profiles?.full_name ?? "Unknown student"}</span>
                    <Badge
                      className={graded ? "bg-success text-success-foreground" : ""}
                      variant={graded ? undefined : "secondary"}
                    >
                      {graded ? `Graded: ${s.grades!.points}` : "Needs grading"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

async function StudentSubmission({
  classId,
  assignmentId,
}: {
  classId: string;
  assignmentId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // submissions_select's RLS (student_id = auth.uid()) means this is
  // always exactly this student's own submission, nothing to filter on
  // top of assignment_id.
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, content, file_path, file_name, submitted_at, status, grades(points, feedback)")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user!.id)
    .maybeSingle<SubmissionWithGrade>();

  if (!submission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submit your answer</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmitForm classId={classId} assignmentId={assignmentId} />
        </CardContent>
      </Card>
    );
  }

  const grade = submission.grades;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your submission</CardTitle>
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

        {grade ? (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">
              Grade: <span className="text-accent">{grade.points}</span>
            </p>
            {grade.feedback && (
              <p className="text-sm text-muted-foreground">{grade.feedback}</p>
            )}
          </div>
        ) : (
          <>
            <Badge variant="secondary" className="self-start">
              Not graded yet
            </Badge>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium">
                Update your submission
              </p>
              <SubmitForm
                classId={classId}
                assignmentId={assignmentId}
                defaultContent={submission.content}
                currentFileName={submission.file_name}
                submitLabel="Update submission"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
