import { Mail } from "lucide-react";
import { TikTokIcon, InstagramIcon, FacebookIcon, WhatsAppIcon } from "@/components/icons/brand-icons";
import { getContactLinks, type ContactKey } from "@/lib/contact";
import { cn } from "@/lib/utils";

const ICONS: Record<ContactKey, React.ComponentType<{ className?: string }>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  whatsapp: WhatsAppIcon,
  email: Mail,
};

/**
 * Renders every configured contact link as an icon button - shared by the
 * landing page footer and the Support dialog so both stay in sync with
 * lib/contact.ts automatically. A link still set to the "REPLACE_ME"
 * placeholder renders disabled with a "Coming soon" title instead of a
 * dead href="#" - see getContactLinks().
 */
export function ContactLinks({ className }: { className?: string }) {
  const links = getContactLinks();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {links.map((link) => {
        const Icon = ICONS[link.key];

        if (!link.href) {
          return (
            <span
              key={link.key}
              title={`${link.label} - Coming soon`}
              aria-disabled="true"
              className="flex size-9 cursor-not-allowed items-center justify-center rounded-full text-muted-foreground/40"
            >
              <Icon className="size-4" />
            </span>
          );
        }

        return (
          <a
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.label}
            aria-label={link.label}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}
