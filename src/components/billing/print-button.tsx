"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Print",
  variant = "secondary",
}: {
  label?: string;
  variant?: "secondary" | "primary" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => window.print()}
      icon={<Printer className="h-4 w-4" aria-hidden />}
      className="no-print"
    >
      {label}
    </Button>
  );
}
