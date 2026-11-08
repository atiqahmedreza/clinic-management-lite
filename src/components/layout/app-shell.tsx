"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Leaf,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";

import { APP_NAME, CLINIC, ROLE_META } from "@/lib/constants";
import { navForRole } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme";
import { logoutAction } from "@/actions/auth.actions";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  React.useEffect(() => setMobileOpen(false), [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      {/* ---------------- desktop sidebar ---------------- */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar lg:flex">
        <SidebarContent role={user.role} pathname={pathname} />
      </aside>

      {/* ---------------- mobile drawer ---------------- */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--overlay)]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sidebar shadow-[var(--shadow-pop)]"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3.5 rounded-[var(--radius-control)] p-1.5 text-sidebar-muted transition-colors duration-150 hover:bg-sidebar-active hover:text-sidebar-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarContent role={user.role} pathname={pathname} />
          </aside>
        </div>
      ) : null}

      {/* ---------------- main column ---------------- */}
      <div className="flex min-w-0 flex-col">
        <header className="app-header sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-canvas px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 lg:hidden"
            aria-label={APP_NAME}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Leaf className="h-4 w-4" aria-hidden />
            </span>
            <span className="display truncate text-[15px] text-ink">
              {CLINIC.name}
            </span>
          </Link>

          <div className="flex-1" />

          <Link
            href="/appointments/new"
            className={buttonClasses("primary", "sm", "hidden sm:inline-flex")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Book visit
          </Link>

          <ThemeToggle className="hidden sm:inline-flex" />

          <UserMenu user={user} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink-muted sm:px-6">
          {CLINIC.name} · {APP_NAME} · Reg. {CLINIC.registration}
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SidebarContent({
  role,
  pathname,
}: {
  role: Role;
  pathname: string;
}) {
  const sections = navForRole(role);

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-line px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-line text-sidebar-ink">
          <Leaf className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="display block truncate text-[15px] leading-tight text-sidebar-ink">
            {CLINIC.name}
          </span>
          <span className="block truncate text-xs text-sidebar-muted">
            {APP_NAME}
          </span>
        </span>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg py-2 pl-3.5 pr-2.5 text-sm font-medium transition-colors duration-150",
                        active
                          ? "bg-sidebar-active text-sidebar-ink before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--accent)] before:content-['']"
                          : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-ink",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          active
                            ? "text-sidebar-ink"
                            : "text-sidebar-muted group-hover:text-sidebar-ink",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-line p-3 lg:hidden">
        <ThemeToggle className="w-full justify-center" />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    await logoutAction();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-medium leading-tight text-ink">
            {user.name}
          </span>
          <span className="block text-[11px] leading-tight text-ink-muted">
            {ROLE_META[user.role].label}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] w-64 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-pop)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">
              {user.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {user.email}
            </p>
            <div className="mt-2">
              <Badge tone={ROLE_META[user.role].tone}>
                {ROLE_META[user.role].label}
              </Badge>
            </div>
          </div>

          <div className="p-2 sm:hidden">
            <ThemeToggle className="w-full justify-center" />
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
