import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { NewExamForm } from "./new-exam-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type ExamRow = {
  id: string;
  title: string;
  level: string;
  is_certification: boolean;
  duration_minutes: number;
  classes: { name: string } | null;
};

export default async function ExamsPage() {
  const { supabase, role } = await requireStaff();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, level, is_certification, duration_minutes, classes(name)")
    .order("created_at", { ascending: false })
    .returns<ExamRow[]>();

  // classes_select's RLS already scopes this to the teacher's own
  // classes (or every class for an admin) - the dropdown naturally only
  // offers classes this user is allowed to attach an exam to.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
        <div className="flex items-center gap-4">
          {/* Admins don't get "Grading queue" in the main nav (grading is
              a teaching task, not a primary admin destination - see
              CLAUDE.md's "Admin nav" section) - this link is their
              backup route to it, reachable in context while overseeing
              exams. Teachers already have it in their main nav, so it's
              not duplicated here for them. */}
          {role === "admin" && (
            <Link href="/exams/grading" className="text-sm text-accent hover:underline">
              Grading queue →
            </Link>
          )}
          <Link href="/exams/questions" className="text-sm text-accent hover:underline">
            Question bank →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{exams?.length ?? 0} exams</CardTitle>
        </CardHeader>
        <CardContent>
          {exams && exams.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {exams.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/exams/${e.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
                  >
                    <span className="flex flex-col">
                      <span>{e.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.classes?.name ?? "Standalone"} · {e.duration_minutes} min
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">{e.level}</Badge>
                      {e.is_certification && <Badge className="bg-gold text-gold-foreground">Certification</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No exams yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New exam</CardTitle>
          <CardDescription>
            Add questions from the bank after creating it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewExamForm classes={classes ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
