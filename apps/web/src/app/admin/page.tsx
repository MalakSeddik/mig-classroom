import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminHubPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link
            href="/admin/courses"
            className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
          >
            Courses
          </Link>
          <Link
            href="/admin/classes"
            className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent"
          >
            Classes &amp; enrollments
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
