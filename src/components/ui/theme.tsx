"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "clinic-theme";

/**
 * Inline script that resolves the theme before first paint, so the page never
 * flashes the wrong colours. It stamps `data-theme` on <html>, which every
 * token in globals.css keys off.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var choice = stored === 'light' || stored === 'dark' ? stored : 'system';
    var dark = choice === 'dark' || (choice === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = React.useState<ThemeChoice>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setChoice(stored === "light" || stored === "dark" ? stored : "system");
    setMounted(true);
  }, []);

  // Follow the OS while the choice is "system".
  React.useEffect(() => {
    if (!mounted || choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice, mounted]);

  const select = (next: ThemeChoice) => {
    setChoice(next);
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing - the choice simply will not persist.
    }
    applyTheme(next);
  };

  const options: { value: ThemeChoice; label: string; icon: React.ElementType }[] =
    [
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
      { value: "system", label: "System", icon: Monitor },
    ];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = mounted && choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            title={`${option.label} theme`}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] transition-colors",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
