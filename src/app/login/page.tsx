import { Suspense } from "react";
import type { Metadata } from "next";
import {
  CalendarCheck2,
  Leaf,
  ReceiptText,
  Stethoscope,
  HeartPulse,
} from "lucide-react";

import { APP_NAME, CLINIC } from "@/lib/constants";
import { Skeleton } from "@/components/ui/states";
import { ThemeToggle } from "@/components/ui/theme";
import { DemoAccounts, LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

const DEMO_ACCOUNTS = [
  {
    role: "Administrator",
    email: "admin@shefaclinic.example",
    description: "Full access, staff and price list management",
  },
  {
    role: "Receptionist",
    email: "reception@shefaclinic.example",
    description: "Registration, booking, billing and payments",
  },
  {
    role: "Doctor",
    email: "dr.rahman@shefaclinic.example",
    description: "Queue, consultations and prescriptions",
  },
];

const WORKFLOW = [
  { icon: HeartPulse, label: "Register the patient" },
  { icon: CalendarCheck2, label: "Book and check in" },
  { icon: Stethoscope, label: "Record the consultation" },
  { icon: ReceiptText, label: "Bill and take payment" },
];

/**
 * Quiet line-art: an arched clinic window with a leaf, drawn in thin strokes
 * so it reads as a mark rather than an illustration competing with the form.
 */
function ArchMark() {
  return (
    <svg
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden
      className="h-auto w-full max-w-sm text-[var(--sidebar-ink)]"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      >
        {/* arched window */}
        <path d="M70 146V74a40 40 0 0 1 80 0v72" />
        <path d="M110 146V34" />
        <path d="M70 100h80" />
        <path d="M56 146h108" />
        {/* sill */}
        <path d="M62 136h96" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      >
        {/* leaf growing through the arch */}
        <path d="M110 34c0-11 8-21 20-24-1 12-8 21-20 24Z" />
        <path d="M110 46c0-10-8-18-19-20 1 11 8 18 19 20Z" />
      </g>
      <g stroke="currentColor" strokeWidth="1.25" opacity="0.3">
        <path d="M24 146h172" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------- brand panel ---------------- */}
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-[var(--sidebar-ink)] lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-line">
            <Leaf className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="display block text-base leading-tight">
              {CLINIC.name}
            </span>
            <span className="block text-xs text-sidebar-muted">{APP_NAME}</span>
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="display text-[1.75rem] leading-snug">
            One record, from the front desk to the receipt.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-sidebar-muted">
            {CLINIC.tagline}. Every appointment carries its consultation, its
            prescription and its invoice — so the visit history and the
            day&apos;s numbers are always the same truth.
          </p>

          <ol className="mt-8 space-y-3">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sidebar-line">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm text-sidebar-muted">
                    <span className="tabular mr-2 text-xs text-sidebar-muted/80">
                      0{index + 1}
                    </span>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 hidden xl:block">
            <ArchMark />
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">
          {CLINIC.addressLine1}, {CLINIC.addressLine2} · {CLINIC.phone}
        </p>
      </section>

      {/* ---------------- form panel ---------------- */}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <Leaf className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <ThemeToggle className="ml-auto" />
          </div>

          <h1 className="display text-[1.75rem] text-ink">
            Sign in to the clinic
          </h1>
          <span className="title-rule mt-2.5" aria-hidden />
          <p className="mt-2.5 text-sm text-ink-muted">
            Use your clinic staff account to continue.
          </p>

          <div className="mt-7">
            <Suspense fallback={<FormFallback />}>
              <LoginForm />
            </Suspense>
          </div>

          <DemoAccounts accounts={DEMO_ACCOUNTS} />

          <p className="mt-6 text-center text-xs text-ink-muted lg:hidden">
            {CLINIC.name} · {CLINIC.phone}
          </p>
        </div>
      </section>
    </div>
  );
}

function FormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[68px] w-full" />
      <Skeleton className="h-[68px] w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
