import type { AuthError } from "@supabase/supabase-js";

/**
 * supabase-js has a known quirk: for some 5xx responses (wrapped as
 * AuthRetryableFetchError), `error.message` ends up being the literal
 * string "{}" instead of the actual server message - the client fails to
 * parse the response body correctly for this error type. Fall back to a
 * generic message rather than showing that to the user.
 */
export function authErrorMessage(error: AuthError): string {
  if (error.name === "AuthRetryableFetchError" || error.message === "{}") {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  return error.message;
}
