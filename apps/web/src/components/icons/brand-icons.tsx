// This project's installed lucide-react version ships no brand/logo
// icons at all (checked directly in node_modules - no tiktok, whatsapp,
// instagram, or facebook glyphs), so these four are small hand-included
// single-path SVGs instead of pulling in a whole extra icon-library
// dependency for four icons. Simplified outlines, not pixel-exact brand
// marks - worth a quick visual check once this renders for real, since
// this sandbox can't screenshot-verify logo fidelity. `email` doesn't
// need one of these - lucide's own `Mail` icon is used for it directly.

type IconProps = { className?: string };

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82c-.98-.86-1.56-2.1-1.56-3.47h-3.14v13.4c0 1.53-1.24 2.77-2.77 2.77a2.77 2.77 0 0 1-2.77-2.77 2.77 2.77 0 0 1 2.77-2.77c.28 0 .54.04.8.12v-3.19a6.03 6.03 0 0 0-.8-.05A5.91 5.91 0 0 0 3.27 15.7 5.91 5.91 0 0 0 9.13 21.6a5.91 5.91 0 0 0 5.86-5.9V9.4a8.94 8.94 0 0 0 4.74 1.36V7.62c-1.14 0-2.24-.4-3.13-1.14a5.4 5.4 0 0 1-.98-.66Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.35" cy="6.65" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21.9v-8.4h2.82l.42-3.27H13.5V8.15c0-.95.26-1.59 1.62-1.59h1.73V3.64C16.53 3.6 15.53 3.5 14.37 3.5c-2.42 0-4.08 1.48-4.08 4.19v2.54H7.46v3.27h2.83v8.4h3.21Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.19.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01s-.52.07-.79.37c-.27.3-1.04 1.01-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35ZM12.05 21.9h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.6 6.6 2.17 12.05 2.17c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88Zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.42-8.31Z" />
    </svg>
  );
}
