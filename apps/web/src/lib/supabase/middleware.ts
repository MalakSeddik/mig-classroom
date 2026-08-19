import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/classes", "/exams", "/admin", "/grades", "/pending"];

/**
 * Runs on every matching request (see the matcher in src/middleware.ts).
 * Two jobs:
 *  1. Refresh the auth session cookie so it doesn't expire while a user
 *     is active - Supabase access tokens are short-lived and need this
 *     periodic refresh via the refresh token.
 *  2. Redirect signed-out users away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) actually revalidates the token against
  // Supabase's Auth server, rather than just trusting whatever is in the
  // cookie - the right check to gate access on.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A pending or rejected user can still sign in - their own profile row
  // stays readable under profiles_select's `id = auth.uid()` branch,
  // deliberately never gated by is_approved() - but every protected page
  // bounces them to the status screen instead. This is a friendlier UX
  // than every page rendering an empty/broken view; it is NOT the real
  // security boundary. RLS is: is_approved() is baked into is_admin(),
  // is_teacher(), teaches_class(), and is_enrolled(), so even a request
  // that bypassed this redirect entirely would still get nothing back
  // from the database.
  if (user && isProtected && request.nextUrl.pathname !== "/pending") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single<{ status: string }>();

    if (profile && profile.status !== "approved") {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
