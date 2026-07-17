import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components and Server Actions. Reads
 * the user's session from request cookies and (where possible) writes
 * refreshed cookies back - respects RLS as the actual signed-in user,
 * unlike the admin client.
 *
 * Server Components can't set cookies (Next.js only allows that in
 * Server Actions/Route Handlers), so `setAll` is wrapped in a try/catch.
 * That's fine here because our middleware also refreshes the session on
 * every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component - safe to ignore since
            // middleware handles session refresh.
          }
        },
      },
    }
  );
}
