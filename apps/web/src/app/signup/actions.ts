"use server";

import { redirect } from "next/navigation";
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

  const supabase = await createClient();

  // full_name is stored as auth user metadata so our database trigger can
  // read it when creating the matching profiles row. Only full_name goes
  // through this path - role is never set from here.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: authErrorMessage(error), message: null };
  }

  // Depending on the project's Auth settings, email confirmation may be
  // required. If so, signUp() succeeds but returns no session yet - the
  // account exists, but the user can't log in until they click the
  // confirmation link in their email.
  if (!data.session) {
    return {
      error: null,
      message: "Check your email to confirm your account, then log in.",
    };
  }

  redirect("/dashboard");
}
