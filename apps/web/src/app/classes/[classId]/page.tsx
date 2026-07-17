import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewAssignmentForm } from "./new-assignment-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type Profile = { role: "student" | "teacher" | "admin" };

type ClassRow = {
  id: string;
  name: string;
  teacher_id: string | null;
  courses: { title: string; level: string } | null;
};

type Assignment = {
  id: string;
  title: string;
  due_date: string | null;
  max_points: number;
};

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
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

  // RLS (classes_select) already only lets this come back if the caller
  // is an admin, the class's own teacher, or an enrolled student -
  // nothing extra to check here.
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, teacher_id, courses(title, level)")
    .eq("id", classId)
    .single<ClassRow>();

  if (!klass) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          Class not found, or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  const isStaffView = klass.teacher_id === user.id || profile?.role === "admin";

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, due_date, max_points")
    .eq("class_id", classId)
    .order("due_date")
    .returns<Assignment[]>();

  // For the student view, figure out which of these assignments already
  // have a submission from this student - submissions_select's RLS
  // (student_id = auth.uid()) means this only ever returns their own
  // rows regardless of who else has submitted.
  let submittedAssignmentIds = new Set<string>();
  if (!isStaffView && assignments && assignments.length > 0) {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("assignment_id")
      .in(
        "assignment_id",
        assignments.map((a) => a.id)
      );
    submittedAssignmentIds = new Set((submissions ?? []).map((s) => s.assignment_id));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{klass.name}</h1>
        <p className="text-muted-foreground">
          {klass.courses?.title} · {klass.courses?.level}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/classes/${classId}/assignments/${a.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                  >
                    <span className="flex flex-col">
                      <span>{a.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.due_date
                          ? `Due ${new Date(a.due_date).toLocaleDateString()}`
                          : "No due date"}{" "}
                        · {a.max_points} pts
                      </span>
                    </span>
                    {!isStaffView && (
                      <Badge
                        className={
                          submittedAssignmentIds.has(a.id)
                            ? "bg-success text-success-foreground"
                            : ""
                        }
                        variant={
                          submittedAssignmentIds.has(a.id) ? undefined : "secondary"
                        }
                      >
                        {submittedAssignmentIds.has(a.id)
                          ? "Submitted"
                          : "Not submitted"}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          )}
        </CardContent>
      </Card>

      {isStaffView && (
        <Card>
          <CardHeader>
            <CardTitle>New assignment</CardTitle>
            <CardDescription>
              Visible immediately to every student enrolled in this class.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewAssignmentForm classId={classId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
