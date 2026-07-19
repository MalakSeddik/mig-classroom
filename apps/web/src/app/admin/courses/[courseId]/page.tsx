import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { CourseForm, type ExistingCourse } from "../course-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase } = await requireAdmin();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, level, description")
    .eq("id", courseId)
    .single<ExistingCourse>();

  if (!course) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Course not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/admin/courses" className="text-sm text-accent hover:underline">
          ← Back to courses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit course</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm existing={course} />
        </CardContent>
      </Card>
    </div>
  );
}
