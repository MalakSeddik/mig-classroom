import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { createSignedUrl } from "@/lib/supabase/signed-url";
import { QuestionForm, type ExistingQuestion } from "../question-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const { supabase } = await requireStaff();

  const { data: question } = await supabase
    .from("question_bank")
    .select(
      "id, level, type, prompt, points, options, correct_answer, accepted_answers, media_path, media_type"
    )
    .eq("id", questionId)
    .single();

  if (!question) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Question not found.</p>
      </div>
    );
  }

  const mediaSignedUrl = question.media_path
    ? await createSignedUrl("exam-media", question.media_path)
    : null;

  const existing: ExistingQuestion = { ...question, mediaSignedUrl };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/exams/questions" className="text-sm text-accent hover:underline">
          ← Back to question bank
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit question</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm existing={existing} />
        </CardContent>
      </Card>
    </div>
  );
}
