"use client";

import { useActionState, useState } from "react";
import { createQuestion, updateQuestion, type QuestionFormState } from "./actions";
import { COURSE_LEVELS, QUESTION_TYPES, isAutoGraded } from "@/lib/exams/constants";
import { EXAM_MEDIA_ACCEPT, isAudioFile } from "@/lib/files/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: QuestionFormState = { error: null };

export type ExistingQuestion = {
  id: string;
  level: string;
  type: string;
  prompt: string;
  points: number;
  options: string[] | null;
  correct_answer: string | null;
  media_path: string | null;
  media_type: string | null;
  mediaSignedUrl: string | null;
};

export function QuestionForm({ existing }: { existing?: ExistingQuestion }) {
  const action = existing
    ? updateQuestion.bind(null, existing.id)
    : createQuestion;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [type, setType] = useState<string>(existing?.type ?? "multiple_choice");
  const [options, setOptions] = useState<string[]>(
    existing?.options && existing.options.length > 0 ? existing.options : ["", ""]
  );
  const initialCorrectIndex =
    existing?.type === "multiple_choice" && existing.options
      ? existing.options.indexOf(existing.correct_answer ?? "")
      : 0;
  const [correctOption, setCorrectOption] = useState(
    initialCorrectIndex >= 0 ? initialCorrectIndex : 0
  );
  const [removeMedia, setRemoveMedia] = useState(false);

  const auto = isAutoGraded(type);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="level">Level</Label>
          <NativeSelect
            id="level"
            name="level"
            defaultValue={existing?.level ?? "A1"}
            required
          >
            {COURSE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <NativeSelect
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          name="prompt"
          rows={3}
          defaultValue={existing?.prompt}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="points">Points</Label>
        <Input
          id="points"
          name="points"
          type="number"
          min={0}
          step="0.5"
          defaultValue={existing?.points ?? 1}
          required
          className="max-w-32"
        />
      </div>

      {type === "multiple_choice" && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Label>Options (select the correct one)</Label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctOption"
                value={i}
                checked={correctOption === i}
                onChange={() => setCorrectOption(i)}
                aria-label={`Option ${i + 1} is correct`}
              />
              <Input
                name="options"
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Option ${i + 1}`}
                required
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOptions(options.filter((_, idx) => idx !== i));
                    if (correctOption >= i && correctOption > 0) {
                      setCorrectOption(correctOption - 1);
                    }
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setOptions([...options, ""])}
          >
            Add option
          </Button>
        </div>
      )}

      {type === "true_false" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctAnswerBoolean">Correct answer</Label>
          <NativeSelect
            id="correctAnswerBoolean"
            name="correctAnswerBoolean"
            defaultValue={existing?.correct_answer ?? "true"}
            className="max-w-40"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </NativeSelect>
        </div>
      )}

      {type === "short_answer" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correctAnswerText">Correct answer</Label>
          <Input
            id="correctAnswerText"
            name="correctAnswerText"
            defaultValue={existing?.correct_answer ?? ""}
            required
          />
        </div>
      )}

      {!auto && (
        <p className="text-sm text-muted-foreground">
          {QUESTION_TYPES.find((t) => t.value === type)?.label} is scored
          manually by a teacher later - no correct answer to store.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="media">
          {existing?.media_path ? "Replace audio/image" : "Attach audio or image (optional)"}
        </Label>
        {existing?.media_path && !removeMedia && (
          <div className="flex items-center gap-3 rounded-md border border-border p-2">
            {existing.mediaSignedUrl && isAudioFile(existing.media_path) ? (
              <audio controls src={existing.mediaSignedUrl} className="h-8" />
            ) : existing.mediaSignedUrl ? (
              <a
                href={existing.mediaSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                View current image
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Media attached</span>
            )}
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="removeMedia"
                checked={removeMedia}
                onChange={(e) => setRemoveMedia(e.target.checked)}
              />
              Remove
            </label>
          </div>
        )}
        <input
          id="media"
          name="media"
          type="file"
          accept={EXAM_MEDIA_ACCEPT}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">
          Image or audio (mp3/m4a/wav) - max 20MB. A question with audio
          plays as a listening question.
        </p>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : existing ? "Save changes" : "Create question"}
      </Button>
    </form>
  );
}
