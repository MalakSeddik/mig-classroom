"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

function subscribeNoop() {
  return () => {};
}

/**
 * next-themes only knows the real theme after mounting (the server has no
 * way to know the user's preference) - useSyncExternalStore reports
 * "false" during server render and the first client render, then "true"
 * right after hydration, avoiding a mismatch without an effect-driven
 * setState. Same pattern already used in this app for other client-only
 * values (AudioRecorder's capabilities, LocalDateTime).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden className="opacity-0" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
