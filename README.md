# MIG Classroom

A full-featured learning management system (LMS) built for **MIG**, a German-language academy. MIG Classroom gives students, teachers, and administrators a single, secure place to run every part of the academy online — coursework, exams and certification, attendance, and grades.

> Built with a security-first architecture: role-based access is enforced at the database level, and exam answer keys are never exposed to students' browsers.

---

## Overview

MIG Classroom replaces scattered spreadsheets and manual workflows with one connected web app tailored to how a language academy actually operates — including the German-specific needs of CEFR levels (A1–C2) and spoken-language assessment.

Three roles, each with a purpose-built experience:

- **Students** — see their classes, submit assignments (text, files, or audio), sit assigned exams, and track their grades and attendance.
- **Teachers** — create assignments and materials, build and grade exams, mark attendance, and manage their classes.
- **Admins** — approve registrations, manage users and roles, and run the course catalogue, classes, and enrollments.

---

## Key Features

### Accounts & access
- **Self-registration with admin approval** — new users request a role (student or teacher) and stay in a *pending* state, locked out of all data until an admin approves and confirms their role.
- **Role-based access control** enforced at the database level (PostgreSQL Row-Level Security), not just hidden in the UI — a student can never read another student's grades, and a teacher can only touch their own classes.
- **Account suspension** instead of deletion, so a disabled user is locked out while their history is preserved.

### Coursework
- Teachers post **assignments** with downloadable materials (PDFs, audio, documents).
- Students submit **text, files, or audio recordings**, and teachers grade with feedback.
- Private file storage — a student's work is reachable only by them, their teacher, and admins, via short-lived signed URLs.

### Exams & certification
- A reusable **question bank** across multiple question types (multiple choice, true/false, short answer, writing, listening, speaking), tagged by CEFR level.
- An **exam builder** to assemble tests, with an assignment model that supports **teacher-assigned quizzes** and **admin-scheduled certification exams** with timed windows.
- **Secure exam delivery** — correct answers are never sent to the student's browser; questions are served through vetted server-side logic, and the timer is enforced server-side.
- **Mixed grading** — objective questions auto-grade instantly (with German umlaut-aware matching), while writing and speaking go to a teacher grading queue.

### Speaking practice
- An in-browser **audio recorder** for spoken answers, wired into both exams (invigilated, limited attempts) and assignments (free practice, re-record freely), with a required microphone check.

### Attendance & grades
- Per-session **attendance** marking, with students able to see their own record.
- A consolidated **grades overview** where students see all their marks in one place and teachers get a per-class gradebook.

### Experience
- Clean, professional **role-based dashboards** tying everything together, with a shared navigation shell.
- **Light and dark mode**, responsive across desktop and mobile, on a consistent brand theme.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database, Auth, Storage | Supabase (PostgreSQL) |
| Access control | PostgreSQL Row-Level Security |
| Monorepo tooling | pnpm workspaces + Turborepo |
| Hosting | Vercel |

---

## Architecture Highlights

A few decisions worth calling out:

- **Security by construction, not by convention.** Every table has Row-Level Security enabled, with policies scoped per role. The exam question tables are staff-only at the database level; students receive question content exclusively through server-side functions that omit the correct answer entirely — so the answer key is never present in any response the browser can see.
- **Server-authoritative exams.** Attempt timing, eligibility, and grading all run on the server. The on-screen countdown is a convenience; the real deadline is enforced server-side, and late or abandoned attempts are handled gracefully rather than lost.
- **Privacy-aware file handling.** Uploaded submissions, materials, and audio live in private storage buckets, served only through short-lived signed URLs to authorized users.
- **One codebase, cleanly separated.** A pnpm + Turborepo monorepo keeps shared configuration and the web app organized, with types and validation shared across client and server.

---

## Getting Started

These steps run the project locally for development.

### Prerequisites

- **Node.js** (LTS version)
- **pnpm** (`corepack enable pnpm`)
- A **Supabase** project (free tier is fine for development)

### 1. Clone and install

```bash
git clone https://github.com/MalakSeddik/mig-workspace.git
cd mig-workspace
pnpm install
```

### 2. Configure environment variables

Create a file at `apps/web/.env.local` with your own Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

You can find these in your Supabase dashboard under **Settings → API**.

> **Never commit `.env.local` or your real keys.** The service-role key bypasses database security and must be kept private — it is used only in server-side code and must never be exposed to the browser.

### 3. Set up the database

Apply the SQL migrations in `supabase/migrations/` to your Supabase project (via the Supabase SQL Editor or the Supabase CLI). These create the schema, roles, and Row-Level Security policies.

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create your first admin

New sign-ups start as a pending student. To create your first administrator, register an account, then set its role to `admin` and status to `approved` directly in the Supabase dashboard (Table Editor → `profiles`). After that, all further user management can be done from within the app.

---

## Deployment

The app is deployed on **Vercel**:

- **Root Directory** is set to `apps/web`.
- The three environment variables above are configured in the Vercel project settings.
- The deployed URL is added to Supabase under **Authentication → URL Configuration** (Site URL and Redirect URLs) so authentication works in production.

---

## Project Status

MIG Classroom is feature-complete and deployed. Ongoing/planned work for a full production launch includes a custom domain, database backups, transactional email for sign-up confirmation, and scheduled background jobs for finalizing exam attempts.

---

## Credits

Designed and built by **ETCH Group**.
