import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "./attendance-form";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Profile = { role: "student" | "teacher" | "admin" };

type SessionRow = {
  id: string;
  session_date: string;
  topic: string | null;
  class_id: string;
  classes: { name: string; teacher_id: string | null } | null;
};

type RosterRow = {
  student_id: string;
  profiles: { full_name: string | null } | null;
};

const STATUS_COUNT_ORDER = ["present", "absent", "late", "excused"] as const;
const STATUS_LABEL: Record<string, string> = {
  present: "present",
  absent: "absent",
  late: "late",
  excused: "excused",
};

export default async function SessionAttendancePage({
  params,
}: {
  params: Promise<{ classId: string; sessionId: string }>;
}) {
  const { classId, sessionId } = await params;
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

  // class_sessions_select's RLS already scopes this to admins, the
  // class's own teacher, or an enrolled student - but this page is a
  // staff-only editing tool (a student's own view is the summary on the
  // parent attendance page), so a non-staff viewer gets redirected back
  // there below rather than shown a form they have no RLS permission to
  // save.
  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, session_date, topic, class_id, classes(name, teacher_id)")
    .eq("id", sessionId)
    .single<SessionRow>();

  if (!session || session.class_id !== classId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">
          Session not found, or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  const isStaffView = session.classes?.teacher_id === user.id || profile?.role === "admin";

  if (!isStaffView) {
    redirect(`/classes/${classId}/attendance`);
  }

  const { data: roster } = await supabase
    .from("enrollments")
    .select("student_id, profiles(full_name)")
    .eq("class_id", classId)
    .returns<RosterRow[]>();

  const { data: existingAttendance } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("session_id", sessionId)
    .returns<{ student_id: string; status: string }[]>();

  const statusByStudent = new Map((existingAttendance ?? []).map((a) => [a.student_id, a.status]));

  const students = (roster ?? [])
    .map((r) => ({
      id: r.student_id,
      name: r.profiles?.full_name ?? "Unknown student",
      // Everyone defaults to present until the teacher adjusts and saves.
      status: statusByStudent.get(r.student_id) ?? "present",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const s of students) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const summary = STATUS_COUNT_ORDER.filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${STATUS_LABEL[status]}`)
    .join(", ");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/classes/${classId}/attendance`} className="text-sm text-accent hover:underline">
          ← Back to sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {formatDateOnly(session.session_date)}
        </h1>
        <p className="text-muted-foreground">
          {session.classes?.name}
          {session.topic && ` · ${session.topic}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{students.length} enrolled</CardTitle>
          {summary && <Badge variant="secondary" className="w-fit">{summary}</Badge>}
        </CardHeader>
        <CardContent>
          {students.length > 0 ? (
            <AttendanceForm classId={classId} sessionId={sessionId} students={students} />
          ) : (
            <p className="text-sm text-muted-foreground">No students enrolled in this class yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
