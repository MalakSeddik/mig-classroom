import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApproveForm } from "./registrations/approve-form";
import { rejectRegistration } from "./registrations/actions";
import { RoleChangeForm } from "./role-change-form";
import { StatusToggleForm } from "./status-toggle-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "student" | "teacher" | "admin";
  status: "pending" | "approved" | "rejected" | "disabled";
  requested_role: string | null;
  created_at: string;
};

type UserRow = ProfileRow & { email: string };

const STATUS_BADGE_VARIANT: Record<ProfileRow["status"], "secondary" | "outline" | "destructive"> = {
  approved: "secondary",
  pending: "outline",
  rejected: "destructive",
  disabled: "destructive",
};

export default async function AdminHubPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const { role: roleFilter, q } = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [{ count: pendingCount }, { count: courseCount }, { count: classCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
  ]);

  // profiles_select's is_admin() branch already scopes this to every
  // profile in the system - same query shape the registrations page
  // already relies on, just without the status filter.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, requested_role, created_at")
    .order("created_at", { ascending: false })
    .returns<ProfileRow[]>();

  // Same admin-client email lookup as the registrations page (profiles
  // has no email column - it lives on auth.users, which PostgREST never
  // exposes). Fine at this app's scale; a bulk lookup would be worth
  // adding if the user base ever grew large.
  const admin = createAdminClient();
  const allUsers: UserRow[] = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return { ...p, email: data.user?.email ?? "(unknown email)" };
    })
  );

  // Filtering happens in JS, not the DB query, since the email half of
  // the search only exists after the admin-client lookup above - fine at
  // this app's scale, same tradeoff already made elsewhere in this file.
  const search = (q ?? "").trim().toLowerCase();
  const users = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !`${u.full_name ?? ""} ${u.email}`.toLowerCase().includes(search)) return false;
    return true;
  });

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
          <CardTitle>
            {users.length} of {allUsers.length} users
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="q" className="text-sm font-medium">
                Search
              </label>
              <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Name or email" className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <NativeSelect id="role" name="role" defaultValue={roleFilter ?? ""} className="w-36">
                <option value="">All roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </NativeSelect>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {(roleFilter || q) && (
              <Button asChild variant="outline">
                <Link href="/admin">Clear</Link>
              </Button>
            )}
          </form>

          {users.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{u.full_name ?? "(no name)"}</span>
                      {u.id === user.id && <Badge variant="outline">You</Badge>}
                      <Badge variant="secondary" className="capitalize">
                        {u.role}
                      </Badge>
                      <Badge variant={STATUS_BADGE_VARIANT[u.status]} className="capitalize">
                        {u.status}
                      </Badge>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {u.id === user.id ? (
                      // Every action below would be rejected by a safety
                      // guard for your own row anyway (see actions.ts) -
                      // no point offering controls that always fail.
                      <span className="text-xs text-muted-foreground">Your own account</span>
                    ) : u.status === "pending" ? (
                      <>
                        <ApproveForm userId={u.id} requestedRole={u.requested_role ?? "student"} />
                        <form action={rejectRegistration.bind(null, u.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            Reject
                          </Button>
                        </form>
                      </>
                    ) : (
                      <>
                        <RoleChangeForm userId={u.id} currentRole={u.role} />
                        <StatusToggleForm userId={u.id} currentStatus={u.status} />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No users match.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
