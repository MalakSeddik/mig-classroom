"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Reusable confirmation dialog for every destructive action in the admin
 * panel (and, going forward, anywhere else that needs one - see
 * CLAUDE.md). Two modes:
 *  - routine: just title/description + a destructive Confirm button.
 *  - high-risk: pass requireTypedConfirmation (e.g. the course/class
 *    name) and the Confirm button stays disabled until the user types
 *    that exact string - makes an accidental click impossible, without
 *    hard-blocking a deliberate cascade delete.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  requireTypedConfirmation,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  requireTypedConfirmation?: string;
  onConfirm: () => Promise<{ error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTypedValue("");
      setError(null);
    }
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result.error) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
    });
  }

  const typedConfirmationSatisfied =
    !requireTypedConfirmation || typedValue === requireTypedConfirmation;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>

        {requireTypedConfirmation && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-typed-value">
              Type <span className="font-medium text-foreground">{requireTypedConfirmation}</span> to
              confirm
            </Label>
            <Input
              id="confirm-typed-value"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !typedConfirmationSatisfied}
            onClick={handleConfirm}
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
