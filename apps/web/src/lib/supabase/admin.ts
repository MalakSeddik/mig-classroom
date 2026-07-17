import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service_role key, which bypasses
 * Row-Level Security entirely. The "server-only" import makes it a build
 * error to accidentally import this file from client-side code — never
 * use this client, or the service_role key, in anything that runs in the
 * browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
