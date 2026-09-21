"use client";

import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signup, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandedBackground } from "@/components/branded-background";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const initialState: SignupState = { error: null, message: null };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-12">
      <BrandedBackground />
      <Link
        href="/"
        className="absolute left-4 top-4 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:left-6 sm:top-6"
      >
        {/* Same bg-white logo-chip exception as the app shell/landing
            page - see "Brand theme" in CLAUDE.md. */}
        <span className="flex shrink-0 items-center justify-center rounded-md bg-white p-1">
          <Image src="/mig-logo.png" alt="MIG Classroom" width={20} height={16} />
        </span>
        <span className="hidden sm:inline">MIG Classroom</span>
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Join MIG Classroom - an admin will review your request.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">I am registering as</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="requestedRole"
                    value="student"
                    defaultChecked
                    className="accent-primary"
                  />
                  Student
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="requestedRole" value="teacher" className="accent-primary" />
                  Teacher
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a request, not a grant - an admin reviews and approves every new account before
                it can access anything.
              </p>
            </fieldset>

            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {state.message && (
              <p className="text-sm text-muted-foreground">{state.message}</p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
