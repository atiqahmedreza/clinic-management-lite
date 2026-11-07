import { Suspense } from "react";
import type { Metadata } from "next";
import {
  CalendarCheck2,
  HeartPulse,
  ReceiptText,
  Stethoscope,
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

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------- brand panel ---------------- */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0b3b38] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <HeartPulse className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight">
              {CLINIC.name}
            </span>
            <span className="block text-xs text-teal-100/80">{APP_NAME}</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            One record, from the front desk to the receipt.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-teal-50/85">
            {CLINIC.tagline}. Every appointment carries its consultation, its
            prescription and its invoice — so the visit history and the day&apos;s
            numbers are always the same truth.
          </p>

          <ol className="mt-8 space-y-3">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm text-teal-50/90">
                    <span className="mr-2 font-mono text-xs text-teal-200/70">
                      0{index + 1}
                    </span>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="relative text-xs text-teal-100/60">
          {CLINIC.addressLine1}, {CLINIC.addressLine2} · {CLINIC.phone}
        </p>
      </section>

      {/* ---------------- form panel ---------------- */}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-white dark:text-[var(--ink-inverse)]">
                <HeartPulse className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <ThemeToggle className="ml-auto" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Sign in to the clinic
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
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
