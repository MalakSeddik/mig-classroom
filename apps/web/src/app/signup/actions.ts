"use server";

import { redirect } from "next/navigation";
import { inspect } from "util";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/supabase/auth-error";

export type SignupState = {
  error: string | null;
  message: string | null;
};

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const requestedRole = formData.get("requestedRole") as string;

  const supabase = await createClient();

  // full_name and requested_role are stored as auth user metadata so our
  // database trigger can read them when creating the matching profiles
  // row. Both are just data the trigger validates and copies - role
  // itself is never set from here, and requested_role never grants
  // anything by itself (see handle_new_user() - it's re-validated
  // server-side against an allowlist regardless of what's sent here).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, requested_role: requestedRole } },
  });

  if (error) {
    // Always log the raw error server-side (visible in the `pnpm dev`
    // terminal), regardless of what authErrorMessage() decides is safe
    // to show in the UI - status/code often carry the real cause (e.g. a
    // 500 from the handle_new_user() trigger failing, which supabase-js
    // sometimes flattens to an unhelpful message client-side) even when
    // error.message alone doesn't.
    console.error(
      "[signup] auth.signUp failed, full error:\n" + inspect(error, { depth: 10, colors: false })
    );
    return { error: authErrorMessage(error), message: null };
  }

  // Depending on the project's Auth settings, email confirmation may be
  // required. If so, signUp() succeeds but returns no session yet - the
  // account exists, but the user can't log in until they click the
  // confirmation link in their email. Either way the new profile starts
  // 'pending' - redirecting to /dashboard when a session does come back
  // immediately is safe because the middleware bounces any non-approved
  // user straight to /pending before they'd see anything real.
  if (!data.session) {
    return {
      error: null,
      message:
        "Check your email to confirm your account. Once confirmed, log in - your account will need admin approval before you can access anything.",
    };
  }

  redirect("/dashboard");
}
