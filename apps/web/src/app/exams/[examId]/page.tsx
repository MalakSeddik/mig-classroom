import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import {
  addQuestionToExam,
  removeQuestionFromExam,
  moveQuestion,
  updatePointsOverride,
} from "./actions";
import { QUESTION_TYPES, COURSE_LEVELS, isAutoGraded } from "@/lib/exams/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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

type ExamQuestionRow = {
  id: string;
  position: number;
  points_override: number | null;
  question_bank: {
    id: string;
    prompt: string;
    type: string;
    points: number;
  } | null;
};

type BankQuestionRow = {
  id: string;
  level: string;
  type: string;
  prompt: string;
  points: number;
};

export default async function ExamBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ level?: string; type?: string }>;
}) {
  const { examId } = await params;
  const { level: filterLevel, type: filterType } = await searchParams;
  const { supabase } = await requireStaff();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, level, is_certification, duration_minutes, classes(name)")
    .eq("id", examId)
    .single<ExamRow>();

  if (!exam) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Exam not found.</p>
      </div>
    );
  }

  const { data: examQuestions } = await supabase
    .from("exam_questions")
    .select("id, position, points_override, question_bank(id, prompt, type, points)")
    .eq("exam_id", examId)
    .order("position")
    .returns<ExamQuestionRow[]>();

  const rows = examQuestions ?? [];
  const totalPoints = rows.reduce(
    (sum, r) => sum + (r.points_override ?? r.question_bank?.points ?? 0),
    0
  );
  const addedQuestionIds = new Set(rows.map((r) => r.question_bank?.id).filter(Boolean));

  let bankQuery = supabase
    .from("question_bank")
    .select("id, level, type, prompt, points")
    .order("created_at", { ascending: false });
  if (filterLevel) bankQuery = bankQuery.eq("level", filterLevel);
  if (filterType) bankQuery = bankQuery.eq("type", filterType);
  const { data: bankQuestions } = await bankQuery.returns<BankQuestionRow[]>();
  const availableQuestions = (bankQuestions ?? []).filter((q) => !addedQuestionIds.has(q.id));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/exams" className="text-sm text-accent hover:underline">
          ← Back to exams
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{exam.title}</h1>
          <Badge variant="secondary">{exam.level}</Badge>
          {exam.is_certification && (
            <Badge className="bg-gold text-gold-foreground">Certification</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {exam.classes?.name ?? "Standalone"} · {exam.duration_minutes} min ·{" "}
          {rows.length} question{rows.length === 1 ? "" : "s"} · {totalPoints} pts total
        </p>
        <Link
          href={`/exams/${examId}/assign`}
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          Assign this exam →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions in this exam</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>#{i + 1}</span>
                      <span>
                        {QUESTION_TYPES.find((t) => t.value === r.question_bank?.type)?.label ??
                          r.question_bank?.type}
                      </span>
                      {!isAutoGraded(r.question_bank?.type ?? "") && (
                        <Badge variant="secondary">Manual grade</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm">{r.question_bank?.prompt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={updatePointsOverride.bind(null, examId, r.id)} className="flex items-center gap-1">
                      <Input
                        type="number"
                        name="pointsOverride"
                        min={0}
                        step="0.5"
                        defaultValue={r.points_override ?? ""}
                        placeholder={`${r.question_bank?.points ?? 0}`}
                        className="h-7 w-20"
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Set pts
                      </Button>
                    </form>
                    <form action={moveQuestion.bind(null, examId, r.id, "up")}>
                      <Button type="submit" variant="outline" size="sm" disabled={i === 0}>
                        ↑
                      </Button>
                    </form>
                    <form action={moveQuestion.bind(null, examId, r.id, "down")}>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={i === rows.length - 1}
                      >
                        ↓
                      </Button>
                    </form>
                    <form action={removeQuestionFromExam.bind(null, examId, r.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No questions added yet - add some from the bank below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add from question bank</CardTitle>
          <CardDescription>Already-added questions are hidden from this list.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="level" className="text-sm font-medium">
                Level
              </label>
              <NativeSelect id="level" name="level" defaultValue={filterLevel ?? ""} className="w-36">
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
              <NativeSelect id="type" name="type" defaultValue={filterType ?? ""} className="w-48">
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
          </form>

          {availableQuestions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {availableQuestions.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{q.level}</Badge>
                      <span>{QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}</span>
                      <span>· {q.points} pts</span>
                    </div>
                    <p className="truncate text-sm">{q.prompt}</p>
                  </div>
                  <form action={addQuestionToExam.bind(null, examId, q.id)}>
                    <Button type="submit" variant="secondary" size="sm">
                      Add
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No matching questions.{" "}
              <Link href="/exams/questions/new" className="text-accent hover:underline">
                Create one
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
