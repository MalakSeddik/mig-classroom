import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { deleteQuestion } from "./actions";
import { COURSE_LEVELS, QUESTION_TYPES, isAutoGraded } from "@/lib/exams/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type QuestionRow = {
  id: string;
  level: string;
  type: string;
  prompt: string;
  points: number;
  media_path: string | null;
};

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; type?: string }>;
}) {
  const { level, type } = await searchParams;
  const { supabase } = await requireStaff();

  let query = supabase
    .from("question_bank")
    .select("id, level, type, prompt, points, media_path")
    .order("created_at", { ascending: false });

  if (level) query = query.eq("level", level);
  if (type) query = query.eq("type", type);

  const { data: questions } = await query.returns<QuestionRow[]>();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Question bank</h1>
        <Button asChild>
          <Link href="/exams/questions/new">New question</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="level" className="text-sm font-medium">
                Level
              </label>
              <NativeSelect id="level" name="level" defaultValue={level ?? ""} className="w-36">
                <option value="">All levels</option>
                {COURSE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="type" className="text-sm font-medium">
                Type
              </label>
              <NativeSelect id="type" name="type" defaultValue={type ?? ""} className="w-48">
                <option value="">All types</option>
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {(level || type) && (
              <Button asChild variant="outline">
                <Link href="/exams/questions">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{questions?.length ?? 0} questions</CardTitle>
        </CardHeader>
        <CardContent>
          {questions && questions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{q.level}</Badge>
                      <span>{QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}</span>
                      <span>·</span>
                      <span>{q.points} pts</span>
                      {!isAutoGraded(q.type) && (
                        <Badge variant="secondary">Manual grade</Badge>
                      )}
                      {q.media_path && <Badge variant="secondary">Media</Badge>}
                    </div>
                    <p className="truncate text-sm">{q.prompt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/exams/questions/${q.id}`}>Edit</Link>
                    </Button>
                    <form action={deleteQuestion.bind(null, q.id, q.media_path)}>
                      <Button type="submit" variant="outline" size="sm">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
