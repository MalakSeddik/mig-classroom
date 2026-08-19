import Link from "next/link";
import { requireStaff } from "@/lib/supabase/require-staff";
import { QuestionForm } from "../question-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function NewQuestionPage() {
  await requireStaff();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/exams/questions" className="text-sm text-accent hover:underline">
          ← Back to question bank
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New question</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm />
        </CardContent>
      </Card>
    </div>
  );
}
