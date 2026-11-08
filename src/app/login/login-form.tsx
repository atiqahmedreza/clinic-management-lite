"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";

import { loginAction, type LoginState } from "@/actions/auth.actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/states";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  // On success the cookie is already set; move to the app and refetch the
  // server components so the shell renders with the signed-in user.
  React.useEffect(() => {
    if (state?.ok) {
      router.replace(state.data.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {state && !state.ok ? (
        <Alert variant="error" title="Could not sign in">
          {state.error}
        </Alert>
      ) : null}

      {state?.ok ? (
        <Alert variant="success">Signed in. Taking you to the clinic…</Alert>
      ) : null}

      <Field
        label="Work email"
        htmlFor="email"
        required
        error={fieldErrors?.email}
      >
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@shefaclinic.example"
            className="pl-9"
            required
            invalid={Boolean(fieldErrors?.email)}
          />
        </div>
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={fieldErrors?.password}
      >
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-9"
            required
            invalid={Boolean(fieldErrors?.password)}
          />
        </div>
      </Field>

      <SubmitButton
        className="w-full"
        size="lg"
        pendingLabel="Signing in…"
        disabled={state?.ok}
      >
        Sign in
      </SubmitButton>
    </form>
  );
}

/** Click-to-fill demo accounts, so a reviewer never has to type credentials. */
export function DemoAccounts({
  accounts,
}: {
  accounts: { role: string; email: string; description: string }[];
}) {
  const fill = (email: string) => {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById(
      "password",
    ) as HTMLInputElement | null;
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordInput) {
      passwordInput.value = "Passw0rd!";
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.focus();
    }
  };

  return (
    <div className="mt-7 rounded-[var(--radius-card)] border border-line bg-surface-muted/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Demo accounts
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Password for all three:{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-ink">
          Passw0rd!
        </code>
      </p>
      <ul className="mt-3 space-y-1.5">
        {accounts.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              onClick={() => fill(account.email)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {account.role}
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {account.email}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-brand-ink">
                Use
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
