// Single source of truth for MIG's public contact/social links - the
// landing page footer and the shared Support dialog both read from
// getContactLinks() below, so a link only ever needs updating here.
//
// EVERY VALUE BELOW IS A PLACEHOLDER. Replace each "REPLACE_ME" with the
// real handle/URL/number before launch - see "Support access & contact
// links" in CLAUDE.md. Until replaced, getContactLinks() reports that
// link as unavailable (href: null) so the UI can render it disabled
// instead of a dead href="#".

export const PLACEHOLDER = "REPLACE_ME";

export const CONTACT = {
  tiktok: "REPLACE_ME", // full profile URL, e.g. "https://www.tiktok.com/@mig.academy"
  instagram: "REPLACE_ME", // full profile URL, e.g. "https://www.instagram.com/mig.academy"
  facebook: "REPLACE_ME", // full profile URL, e.g. "https://www.facebook.com/mig.academy"
  whatsapp: "REPLACE_ME", // raw number, digits only, country code first, no "+" or spaces - e.g. "491701234567"
  email: "REPLACE_ME", // e.g. "info@mig-academy.de"
} as const;

export type ContactKey = keyof typeof CONTACT;

export type ContactLink = {
  key: ContactKey;
  label: string;
  /** null when the configured value is still a placeholder - render this
   * link disabled ("Coming soon"), never as a dead href="#". */
  href: string | null;
};

const LABELS: Record<ContactKey, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  email: "Email",
};

function buildHref(key: ContactKey, value: string): string {
  if (key === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    return `https://wa.me/${digits}`;
  }
  if (key === "email") {
    return `mailto:${value}`;
  }
  return value;
}

export function getContactLinks(): ContactLink[] {
  return (Object.keys(CONTACT) as ContactKey[]).map((key) => {
    const value: string = CONTACT[key];
    const isPlaceholder = !value || value === PLACEHOLDER;
    return {
      key,
      label: LABELS[key],
      href: isPlaceholder ? null : buildHref(key, value),
    };
  });
}

// The quiet "Powered by ETCH Group" credit shown on the landing page
// footer and the app shell footer - see <PoweredBySignature>. Same
// placeholder-aware shape as CONTACT above: leave `url` as PLACEHOLDER
// until ETCH has a real site to link to.
export const SIGNATURE = {
  label: "ETCH Group",
  url: "REPLACE_ME", // full URL, e.g. "https://etchgroup.com"
} as const;

export function getSignature(): { label: string; href: string | null } {
  const isPlaceholder = !SIGNATURE.url || SIGNATURE.url === PLACEHOLDER;
  return {
    label: SIGNATURE.label,
    href: isPlaceholder ? null : SIGNATURE.url,
  };
}
