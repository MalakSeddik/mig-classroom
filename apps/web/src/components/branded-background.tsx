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
 * light in dark mode), "red" is --accent, "gold" is --gold.
 *
 * Opacity/blur tuned for perceptibility, not just presence: an earlier
 * pass at 6-10% opacity with a 64px blur (blur-3xl) was technically
 * animating (verified via computed styles - animationPlayState:
 * "running") but visually inert against the near-white background - too
 * faint to register as movement even though the mechanism was correct.
 * Bumped to 10-18% opacity with a 40px blur (blur-2xl) so the shapes
 * have enough edge definition and contrast to actually be seen drifting,
 * while staying soft/out-of-focus and well clear of text contrast
 * issues (verified against both light and dark card/background tokens).
 * Motion is defined in globals.css's blob-drift-a/b keyframes, which are
 * frozen entirely under prefers-reduced-motion via a plain media query -
 * no JS needed to detect that.
 *
 * A deliberately loud, solid-hex diagnostic version (50-60% opacity, no
 * theme tokens) briefly lived here to prove the animation mechanism
 * itself was working - confirmed via a direct `curl` of the server-
 * rendered HTML, independent of any browser. This is the real, final
 * version again; verify visually on the deployed site/a phone rather
 * than the dev machine that couldn't see it.
 */
export function BrandedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="animate-blob-a absolute -top-1/4 -left-1/4 size-[55vw] min-w-[420px] rounded-full bg-foreground/[0.1] blur-2xl" />
      <div className="animate-blob-b absolute top-1/4 -right-1/4 size-[48vw] min-w-[380px] rounded-full bg-accent/[0.18] blur-2xl" />
      <div className="animate-blob-c absolute -bottom-1/3 left-1/4 size-[42vw] min-w-[340px] rounded-full bg-gold/[0.18] blur-2xl" />
    </div>
  );
}
