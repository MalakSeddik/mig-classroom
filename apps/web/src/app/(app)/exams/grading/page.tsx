import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type AttemptRow = {
  id: string;
  status: string;
  total_score: number | null;
  is_late: boolean;
  auto_submitted: boolean;
  profiles: { full_name: string | null } | null;
  exams: { id: string; title: string; class_id: string | null } | null;
};

export default async function GradingQueuePage() {
  const { supabase, user, role } = await requireStaff();

  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("id, status, total_score, is_late, auto_submitted, profiles(full_name), exams(id, title, class_id)")
    .in("status", ["auto_graded", "final"])
    .order("submitted_at", { ascending: false })
    .returns<AttemptRow[]>();

  // exam_attempts_staff_all grants every teacher/admin RLS access to
  // every attempt (inherited from Step 5 part 1's staff-wide design, not
  // something new here) - this narrows the *displayed* list to the
  // teacher's own classes for relevance, the same RLS-is-broad/UI-narrows
  // pattern already used elsewhere (isStaffView checks). Admins see
  // everything.
  let visible = attempts ?? [];
  if (role === "teacher") {
    const { data: myClasses } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
    const myClassIds = new Set((myClasses ?? []).map((c) => c.id));
    visible = visible.filter((a) => a.exams?.class_id && myClassIds.has(a.exams.class_id));
  }

  const needsGrading = visible.filter((a) => a.status === "auto_graded");
  const alreadyGraded = visible.filter((a) => a.status === "final");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Grading queue</h1>

      <Card>
        <CardHeader>
          <CardTitle>{needsGrading.length} need grading</CardTitle>
        </CardHeader>
        <CardContent>
          <AttemptList attempts={needsGrading} empty="Nothing pending." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Already graded</CardTitle>
        </CardHeader>
        <CardContent>
          <AttemptList attempts={alreadyGraded} empty="No finalized attempts yet." />
        </CardContent>
      </Card>
    </div>
  );
}

function AttemptList({ attempts, empty }: { attempts: AttemptRow[]; empty: string }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {attempts.map((a) => (
        <li key={a.id}>
          <Link
            href={`/exams/grading/${a.id}`}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
          >
            <span className="flex flex-col">
              <span>{a.profiles?.full_name ?? "Unknown student"}</span>
              <span className="text-xs text-muted-foreground">{a.exams?.title}</span>
            </span>
            <span className="flex items-center gap-2">
              {a.total_score !== null && <span>{a.total_score} pts</span>}
              {a.is_late && <Badge variant="secondary">Late</Badge>}
              {a.auto_submitted && <Badge variant="secondary">Auto-submitted</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
