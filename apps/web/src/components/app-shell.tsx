"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  ClipboardCheck,
  Award,
  Shield,
  UserCheck,
  GraduationCap,
  Users,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { SupportDialog } from "@/components/support-dialog";
import { cn } from "@/lib/utils";
import type { CurrentProfile } from "@/lib/supabase/current-user";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

// Every item links to a route that actually exists today - deeper,
// per-class navigation (a class's own assignments/attendance/grades)
// stays reachable the way it already is, via the class page's own links,
// not duplicated here at the top level.
function getNavItems(role: CurrentProfile["role"], pendingRegistrations: number): NavItem[] {
  if (role === "admin") {
    return [
      { label: "Admin home", href: "/admin", icon: Shield },
      { label: "Registrations", href: "/admin/registrations", icon: UserCheck, badge: pendingRegistrations },
      { label: "Courses", href: "/admin/courses", icon: GraduationCap },
      { label: "Classes", href: "/admin/classes", icon: Users },
      { label: "Exams", href: "/exams", icon: FileText },
      { label: "Question bank", href: "/exams/questions", icon: BookOpen },
      { label: "Grading queue", href: "/exams/grading", icon: ClipboardCheck },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Classes", href: "/classes", icon: Users },
      { label: "Exams", href: "/exams", icon: FileText },
      { label: "Question bank", href: "/exams/questions", icon: BookOpen },
      { label: "Grading queue", href: "/exams/grading", icon: ClipboardCheck },
    ];
  }
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My classes", href: "/classes", icon: Users },
    { label: "My exams", href: "/exams/my-exams", icon: FileText },
    { label: "Grades", href: "/grades", icon: Award },
  ];
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon className="size-4" />
              {item.label}
            </span>
            {!!item.badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-semibold text-gold-foreground">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  profile,
  pendingRegistrations,
  children,
}: {
  profile: CurrentProfile;
  pendingRegistrations: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getNavItems(profile.role, pendingRegistrations);

  const brand = (
    <Link
      href={profile.role === "admin" ? "/admin" : "/dashboard"}
      className="flex items-center gap-2 px-2"
    >
      {/* The logo PNG has a light background baked in (see "Brand theme"
          in CLAUDE.md) - a literal white chip here, not a theme token, so
          it stays legible even when the sidebar itself goes dark. */}
      <span className="flex shrink-0 items-center justify-center rounded-md bg-white p-1">
        <Image src="/mig-logo.png" alt="MIG Classroom" width={26} height={21} />
      </span>
      <span className="text-sm font-semibold tracking-tight">MIG Classroom</span>
    </Link>
  );

  const userFooter = (
    <div className="flex flex-col gap-3 border-t border-sidebar-border pt-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{profile.fullName || profile.email}</span>
          <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
        </div>
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-2 px-2">
        <SupportDialog />
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-6">
          {brand}
          <NavLinks items={items} pathname={pathname} />
        </div>
        {userFooter}
      </aside>

      <div className="flex flex-1 flex-col md:min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          {brand}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="flex flex-1 flex-col bg-background">{children}</main>
      </div>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between bg-sidebar px-3 py-4 text-sidebar-foreground shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                {brand}
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className="rounded-lg p-2 hover:bg-sidebar-accent"
                >
                  <X className="size-5" />
                </DialogPrimitive.Close>
              </div>
              <NavLinks items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
            {userFooter}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
