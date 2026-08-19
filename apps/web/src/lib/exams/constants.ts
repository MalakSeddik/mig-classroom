export const COURSE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// The question_type enum in the DB also has 'listening', but this app
// treats "listening" as an attribute (a question with audio attached),
// not a distinct authorable type - so it's deliberately left out of this
// list. See CLAUDE.md for the reasoning.
export const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short answer" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

// multiple_choice/true_false/short_answer can be graded automatically by
// comparing a stored correct_answer; writing/speaking need a teacher to
// read/listen and score them - correct_answer stays null for those.
export const AUTO_GRADED_TYPES = new Set<QuestionType>([
  "multiple_choice",
  "true_false",
  "short_answer",
]);

export function isAutoGraded(type: string): boolean {
  return AUTO_GRADED_TYPES.has(type as QuestionType);
}

// question_bank has no per-question recording-length column, so a
// speaking answer's cap is a fixed constant rather than something set per
// question. Invigilated mode: one take, no re-recording - matches a real
// speaking exam rather than practice.
export const SPEAKING_ANSWER_MAX_DURATION_SECONDS = 120;
export const SPEAKING_ANSWER_MAX_ATTEMPTS = 1;

// Normalizes text for auto-grading comparison: trims, lowercases, then
// folds German umlauts/eszett to their unaccented ASCII spelling, so
// "Straße", "strasse", and "STRASSE" all compare equal. Used for both
// true_false ("true"/"false" already normalize trivially) and
// short_answer (compared against every accepted_answers entry).
export function normalizeAnswerText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}
