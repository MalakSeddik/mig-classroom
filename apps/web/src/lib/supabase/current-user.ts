import "server-only";
import { cache } from "react";
import { createClient } from "./server";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: "student" | "teacher" | "admin";
  status: "pending" | "approved" | "rejected";
};

/**
 * Wrapped in React's cache() so the (app) shell layout and any page under
 * it can both call this without a duplicate round-trip - React dedupes
 * calls to the same cache()-wrapped function within one request/render
 * pass. Read-only, RLS already scopes "own row" for a signed-in user.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single<{
      full_name: string | null;
      role: "student" | "teacher" | "admin";
      status: "pending" | "approved" | "rejected";
    }>();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status,
  };
});
