import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { Button } from "@/components/ui/button";
import { BrandedBackground } from "@/components/branded-background";
import { ContactLinks } from "@/components/contact-links";
import { PoweredBySignature } from "@/components/powered-by-signature";

/**
 * The public front door. A signed-in visitor is sent straight to
 * /dashboard rather than shown this - /dashboard itself then redirects
 * admins to /admin and non-approved users get bounced to /pending by the
 * middleware, so this one check is enough regardless of role or status.
 */
export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background">
      <BrandedBackground />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          {/* The logo PNG has a light background baked in (see "Brand
              theme" in CLAUDE.md) - a literal white chip, not a theme
              token, same deliberate exception used in the app shell. */}
          <span className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
            <Image src="/mig-logo.png" alt="MIG Classroom logo" width={88} height={72} priority />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">MIG Classroom</h1>
            <p className="text-muted-foreground">
              The online classroom for MIG&apos;s German-language academy - assignments, exams,
              attendance, and grades, all in one place.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="flex-1 sm:flex-none sm:px-8">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1 sm:flex-none sm:px-8">
              <Link href="/signup">Register</Link>
            </Button>
          </div>
        </div>
      </div>

      <footer className="flex flex-col items-center gap-3 border-t border-border/60 px-6 py-6">
        <ContactLinks />
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MIG Classroom. All rights reserved.
          </p>
          <PoweredBySignature />
        </div>
      </footer>
    </div>
  );
}
