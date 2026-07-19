"use client";

import { useSyncExternalStore } from "react";

// A no-op external store whose only job is to report "are we hydrated
// on the client yet" without the setState-in-effect pattern the newer
// react-hooks lint rules flag - getServerSnapshot/getSnapshot differing
// is exactly what useSyncExternalStore exists to reconcile safely across
// the server/client boundary.
function subscribe() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/**
 * Renders a stored timestamptz (an ISO string, always UTC on the wire) in
 * the *viewer's* local timezone. Formatting only happens after mount
 * (client-side, in the browser) rather than during server rendering -
 * doing it in a Server Component would use the server's timezone instead
 * of the viewer's, which is wrong for the same reason a Server Action
 * shouldn't parse a datetime-local value itself (see the assign-to-
 * students form). The "…" placeholder is what both server and client
 * render before hydration, so there's no mismatch warning.
 */
export function LocalDateTime({
  value,
  options,
}: {
  value: string | null;
  options?: Intl.DateTimeFormatOptions;
}) {
  // Server and the first client render both report "not mounted" (false),
  // so there's no hydration mismatch; React swaps to the real, client-only
  // snapshot (true) right after hydration, no setState-in-effect needed.
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!value) return null;
  if (!mounted) return <span>…</span>;
  return <span>{new Date(value).toLocaleString(undefined, options)}</span>;
}
