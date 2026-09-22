import { getSignature } from "@/lib/contact";
import { cn } from "@/lib/utils";

/**
 * Quiet "Powered by ETCH Group" credit - shared by the landing page
 * footer and the app shell's own footer (desktop sidebar + mobile
 * drawer) so both stay in sync with lib/contact.ts automatically.
 * Deliberately the most muted text in either footer - a quiet credit,
 * not a second brand competing with MIG's own. Renders as plain,
 * non-clickable text while SIGNATURE.url is still the "REPLACE_ME"
 * placeholder (see getSignature()), or a real new-tab link once a URL
 * is set - same placeholder-aware pattern <ContactLinks> already uses
 * for the social icons.
 */
export function PoweredBySignature({ className }: { className?: string }) {
  const { label, href } = getSignature();
  const text = `Powered by ${label}`;

  if (!href) {
    return <p className={cn("text-[11px] text-muted-foreground/60", className)}>{text}</p>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground",
        className
      )}
    >
      {text}
    </a>
  );
}
