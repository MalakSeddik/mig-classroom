import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminHubPage() {
  const { supabase } = await requireAdmin();

  const [{ count: pendingCount }, { count: courseCount }, { count: classCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Academy-wide overview and management.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <span className="text-3xl font-semibold tracking-tight">{courseCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">Courses</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <span className="text-3xl font-semibold tracking-tight">{classCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">Classes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <span className="text-3xl font-semibold tracking-tight text-accent">{pendingCount ?? 0}</span>
            <span className="text-sm text-muted-foreground">Pending registrations</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href="/admin/registrations"
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:border-accent hover:text-accent"
          >
            <span className="flex flex-col">
              <span className="font-medium">Registration requests</span>
              <span className="text-xs text-muted-foreground">Approve or reject new signups</span>
            </span>
            {!!pendingCount && <Badge className="bg-gold text-gold-foreground">{pendingCount}</Badge>}
          </Link>
          <Link
            href="/admin/courses"
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:border-accent hover:text-accent"
          >
            <span className="flex flex-col">
              <span className="font-medium">Courses</span>
              <span className="text-xs text-muted-foreground">Create and edit courses</span>
            </span>
          </Link>
          <Link
            href="/admin/classes"
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:border-accent hover:text-accent sm:col-span-2"
          >
            <span className="flex flex-col">
              <span className="font-medium">Classes &amp; enrollments</span>
              <span className="text-xs text-muted-foreground">Manage classes, teachers, and rosters</span>
            </span>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
