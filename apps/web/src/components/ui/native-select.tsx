import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A plain native <select>, styled to match Input. Used instead of the
 * Radix-based Select component for simple cases (filters, single-choice
 * dropdowns) so plain HTML forms keep working with zero client JS -
 * native selects participate in FormData automatically.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      // Same extension-injected fdprocessedid attribute as Input (see its
      // own comment) - a real post-SSR DOM mutation, not an app bug.
      suppressHydrationWarning
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
