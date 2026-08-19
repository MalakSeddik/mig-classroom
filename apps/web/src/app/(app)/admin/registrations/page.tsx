import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApproveForm } from "./approve-form";
import { rejectRegistration } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type PendingProfile = {
  id: string;
  full_name: string | null;
  requested_role: string | null;
  created_at: string;
};

type PendingRequest = PendingProfile & { email: string };

export default async function RegistrationRequestsPage() {
  const { supabase } = await requireAdmin();

  // profiles_select's is_admin() branch already scopes this to every
  // profile, admin-only - no extra filtering needed beyond status.
  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, requested_role, created_at")
    .eq("status", "pending")
    .order("created_at")
    .returns<PendingProfile[]>();

  // profiles has no email column (that lives on auth.users, which
  // PostgREST never exposes directly) - the admin client's Auth API is
  // the only way to look it up. Scoped tightly to this already-verified
  // admin-only page, one lookup per pending row, same "tightly scoped to
  // an already-verified user" case admin.ts's own doc comment describes.
  const admin = createAdminClient();
  const requests: PendingRequest[] = await Promise.all(
    (pending ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return { ...p, email: data.user?.email ?? "(unknown email)" };
    })
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Registration requests</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{requests.length} pending</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{r.full_name ?? "(no name)"}</span>
                    <span className="text-xs text-muted-foreground">{r.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Requested {r.requested_role ?? "student"} · Signed up{" "}
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ApproveForm userId={r.id} requestedRole={r.requested_role ?? "student"} />
                    <form action={rejectRegistration.bind(null, r.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
