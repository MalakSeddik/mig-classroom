/**
 * Subtle, slow-moving gradient blobs for the three public pages (/,
 * /login, /signup) - purely decorative, so it's a Server Component with
 * no state, no "use client" needed. `pointer-events-none` and `-z-10`
 * keep it strictly behind and out of the way of real content; the parent
 * page supplies `relative overflow-hidden` so these blobs clip to the
 * page instead of the viewport.
 *
 * Colors come from theme tokens (--foreground/--accent/--gold), not
 * hardcoded hex, so this reads correctly in both light and dark mode
 * automatically - "black" is literally --foreground (dark in light mode,
 * light in dark mode), "red" is --accent, "gold" is --gold. Opacity stays
 * low (8-10%) specifically so text placed on top never loses contrast.
 * Motion is defined in globals.css's blob-drift-a/b keyframes, which are
 * frozen entirely under prefers-reduced-motion via a plain media query -
 * no JS needed to detect that.
 */
export function BrandedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="animate-blob-a absolute -top-1/4 -left-1/4 size-[55vw] min-w-[420px] rounded-full bg-foreground/[0.06] blur-3xl" />
      <div className="animate-blob-b absolute top-1/4 -right-1/4 size-[48vw] min-w-[380px] rounded-full bg-accent/10 blur-3xl" />
      <div className="animate-blob-c absolute -bottom-1/3 left-1/4 size-[42vw] min-w-[340px] rounded-full bg-gold/10 blur-3xl" />
    </div>
  );
}
