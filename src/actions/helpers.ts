import "server-only";

/**
 * Small helpers shared by the server actions. Forms post `FormData`; these
 * turn that into the plain objects the Zod schemas expect.
 */

/** Read every entry of a FormData into a plain object of strings. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

/**
 * Repeating rows (prescriptions, invoice lines) are posted as one JSON string
 * so the whole collection arrives atomically.
 */
export function readJsonField<T>(
  formData: FormData,
  field: string,
  fallback: T,
): T {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Checkbox groups post one value per checked box. */
export function readAll(formData: FormData, field: string): string[] {
  return formData
    .getAll(field)
    .filter((value): value is string => typeof value === "string");
}

export function readCheckbox(formData: FormData, field: string): boolean {
  const value = formData.get(field);
  return value === "on" || value === "true";
}
