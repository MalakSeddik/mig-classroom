import type { AuthError } from "@supabase/supabase-js";

/**
 * supabase-js has a known quirk: for some 5xx responses (wrapped as
 * AuthRetryableFetchError), `error.message` ends up being the literal
 * string "{}" instead of the actual server message - the client fails to
 * parse the response body correctly for this error type. Only that
 * specific case (and a genuinely empty message) falls back to a generic
 * string; every other error - a real validation error, a real database/
 * trigger error, a network failure with an actual message - is shown
 * as-is. This previously also caught every AuthRetryableFetchError
 * regardless of whether its message was useful, which silently hid real
 * errors (e.g. a signup-trigger failure surfacing as a 500) behind
 * "Something went wrong" with no way to tell what actually broke -
 * exactly the failure mode every other Server Action in this app avoids
 * by just returning error.message directly.
 */
export function authErrorMessage(error: AuthError): string {
  if (!error.message || error.message === "{}") {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  return error.message;
}
