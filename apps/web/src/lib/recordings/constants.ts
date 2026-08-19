// Practice mode for an assignment's spoken answer: generous relative to
// the invigilated exam cap (SPEAKING_ANSWER_MAX_DURATION_SECONDS /
// SPEAKING_ANSWER_MAX_ATTEMPTS in lib/exams/constants.ts) - a student
// refining a homework answer should have real room to redo it, not one
// shot under a strict clock. maxAttempts here only bounds a single
// <AudioRecorder> mount; the submission form remounts a fresh instance
// (a new key) every time the student wants to try again after already
// using a take, so the practical limit is unlimited re-recording.
export const ASSIGNMENT_AUDIO_MAX_DURATION_SECONDS = 300; // 5 minutes
export const ASSIGNMENT_AUDIO_MAX_ATTEMPTS = 10;
