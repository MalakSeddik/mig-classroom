import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// For a plain `date` column (e.g. class_sessions.session_date), never
// format it via `new Date(dateString).toLocaleDateString()` - a bare
// "YYYY-MM-DD" string parses as UTC midnight, so a viewer west of UTC
// (most of the Americas) would see it roll back a day. Parsing the parts
// and building a *local* Date instead sidesteps that entirely - there's
// no timezone conversion to go wrong for a value that was never a moment
// in time to begin with, just a calendar date.
export function formatDateOnly(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString()
}
