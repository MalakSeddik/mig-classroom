import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (the browser). Backed by
 * @supabase/ssr, which stores the session in cookies instead of
 * localStorage - that's what lets the server (middleware, Server
 * Components) read the same session.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
