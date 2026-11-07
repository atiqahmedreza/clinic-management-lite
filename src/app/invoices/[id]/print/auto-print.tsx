"use client";

import { useEffect } from "react";

/**
 * Opens the browser print dialog once the receipt has rendered. Kept in its
 * own client component so the receipt itself stays a server component.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
