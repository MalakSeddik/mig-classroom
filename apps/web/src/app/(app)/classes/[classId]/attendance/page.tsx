import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewSessionForm } from "./new-session-form";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "@/lib/utils";
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
};

type SessionRow = {
  id: string;
  session_date: string;
  topic: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

export default async function AttendancePage({
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

  // classes_select's RLS already scopes this to admins, the class's own
  // teacher, or an enrolled student - same pattern as the class page.
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, teacher_id")
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

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date, topic")
    .eq("class_id", classId)
    .order("session_date")
    .returns<SessionRow[]>();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-accent hover:underline">
          ← Back to class
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isStaffView ? "Attendance" : "My attendance"}
        </h1>
        <p className="text-muted-foreground">{klass.name}</p>
      </div>

      {isStaffView ? (
        <StaffSessionsList classId={classId} sessions={sessions ?? []} />
      ) : (
        <StudentAttendance sessions={sessions ?? []} studentId={user.id} />
      )}

      {isStaffView && (
        <Card>
          <CardHeader>
            <CardTitle>New session</CardTitle>
            <CardDescription>Everyone defaults to present - adjust after creating it.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewSessionForm classId={classId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function StaffSessionsList({
  classId,
  sessions,
}: {
  classId: string;
  sessions: SessionRow[];
}) {
  const supabase = await createClient();

  // One extra query to show how many students have a recorded status per
  // session - a session nobody has taken attendance for yet (freshly
  // created) should read differently from one that's fully recorded.
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("session_id")
    .in("session_id", sessions.length > 0 ? sessions.map((s) => s.id) : [""]);

  const recordedCountBySession = new Map<string, number>();
  for (const a of attendanceRows ?? []) {
    recordedCountBySession.set(a.session_id, (recordedCountBySession.get(a.session_id) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sessions.length} sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const recorded = recordedCountBySession.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/classes/${classId}/attendance/${s.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                  >
                    <span className="flex flex-col">
                      <span>{formatDateOnly(s.session_date)}</span>
                      {s.topic && <span className="text-xs text-muted-foreground">{s.topic}</span>}
                    </span>
                    <Badge variant={recorded > 0 ? undefined : "secondary"}>
                      {recorded > 0 ? `${recorded} recorded` : "Not recorded yet"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

async function StudentAttendance({
  sessions,
  studentId,
}: {
  sessions: SessionRow[];
  studentId: string;
}) {
  const supabase = await createClient();

  // attendance_select's RLS (student_id = auth.uid()) already means this
  // can only ever be this student's own rows - filtering explicitly here
  // too, same belt-and-suspenders style as StudentSubmission elsewhere in
  // this app.
  const { data: myAttendance } = await supabase
    .from("attendance")
    .select("session_id, status")
    .eq("student_id", studentId)
    .in("session_id", sessions.length > 0 ? sessions.map((s) => s.id) : [""])
    .returns<{ session_id: string; status: string }[]>();

  const statusBySession = new Map((myAttendance ?? []).map((a) => [a.session_id, a.status]));

  const recorded = [...statusBySession.values()];
  const presentCount = recorded.filter((s) => s === "present").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sessions.length} sessions</CardTitle>
        {recorded.length > 0 && (
          <CardDescription>
            Present {presentCount}/{recorded.length}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {sessions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const status = statusBySession.get(s.id);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="flex flex-col">
                    <span>{formatDateOnly(s.session_date)}</span>
                    {s.topic && <span className="text-xs text-muted-foreground">{s.topic}</span>}
                  </span>
                  <Badge
                    className={status === "present" ? "bg-success text-success-foreground" : ""}
                    variant={status ? (status === "present" ? undefined : "secondary") : "secondary"}
                  >
                    {status ? STATUS_LABEL[status] : "Not recorded yet"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
