import type {
  AppointmentStatus,
  AppointmentType,
  BloodGroup,
  Gender,
  InvoiceStatus,
  PaymentMethod,
  Role,
  ServiceCategory,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Clinic identity
// ---------------------------------------------------------------------------

export const APP_NAME = "Clinic Management Lite";

export const CLINIC = {
  name: "Shefa Family Clinic",
  tagline: "Primary care, diagnostics & follow-up",
  addressLine1: "House 42, Road 11, Banani",
  addressLine2: "Dhaka 1213, Bangladesh",
  phone: "+880 9612 345 678",
  email: "care@shefaclinic.example",
  registration: "DGHS-REG-2019-10482",
} as const;

export const CURRENCY_SYMBOL = "৳ "; // Bangladeshi Taka sign + nbsp
export const CURRENCY_CODE = "BDT";

export const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Badge tones shared by every status chip in the UI
// ---------------------------------------------------------------------------

export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

type LabelMap<T extends string> = Record<T, { label: string; tone: Tone }>;

// ---------------------------------------------------------------------------
// Enum presentation
// ---------------------------------------------------------------------------

export const ROLE_META: LabelMap<Role> = {
  ADMIN: { label: "Administrator", tone: "accent" },
  DOCTOR: { label: "Doctor", tone: "info" },
  RECEPTIONIST: { label: "Receptionist", tone: "neutral" },
};

export const GENDER_META: LabelMap<Gender> = {
  MALE: { label: "Male", tone: "info" },
  FEMALE: { label: "Female", tone: "accent" },
  OTHER: { label: "Other", tone: "neutral" },
};

export const BLOOD_GROUP_META: Record<BloodGroup, string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A−",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B−",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB−",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O−",
  UNKNOWN: "Unknown",
};

export const APPOINTMENT_STATUS_META: LabelMap<AppointmentStatus> = {
  SCHEDULED: { label: "Scheduled", tone: "info" },
  CHECKED_IN: { label: "Checked in", tone: "warning" },
  IN_CONSULTATION: { label: "In consultation", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  NO_SHOW: { label: "No show", tone: "danger" },
};

export const APPOINTMENT_TYPE_META: LabelMap<AppointmentType> = {
  NEW_VISIT: { label: "New visit", tone: "info" },
  FOLLOW_UP: { label: "Follow-up", tone: "neutral" },
  EMERGENCY: { label: "Emergency", tone: "danger" },
};

export const INVOICE_STATUS_META: LabelMap<InvoiceStatus> = {
  UNPAID: { label: "Unpaid", tone: "danger" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const PAYMENT_METHOD_META: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_BANKING: "Mobile banking",
  BANK_TRANSFER: "Bank transfer",
};

export const SERVICE_CATEGORY_META: LabelMap<ServiceCategory> = {
  CONSULTATION: { label: "Consultation", tone: "info" },
  LAB_TEST: { label: "Lab test", tone: "accent" },
  PROCEDURE: { label: "Procedure", tone: "warning" },
  MEDICATION: { label: "Medication", tone: "success" },
  OTHER: { label: "Other", tone: "neutral" },
};

// ---------------------------------------------------------------------------
// Option lists for <select> inputs
// ---------------------------------------------------------------------------

export function optionsFrom<T extends string>(
  meta: LabelMap<T> | Record<T, string>,
): { value: T; label: string }[] {
  return (Object.entries(meta) as [T, { label: string } | string][]).map(
    ([value, info]) => ({
      value,
      label: typeof info === "string" ? info : info.label,
    }),
  );
}

export const GENDER_OPTIONS = optionsFrom(GENDER_META);
export const BLOOD_GROUP_OPTIONS = optionsFrom(BLOOD_GROUP_META);
export const ROLE_OPTIONS = optionsFrom(ROLE_META);
export const APPOINTMENT_TYPE_OPTIONS = optionsFrom(APPOINTMENT_TYPE_META);
export const APPOINTMENT_STATUS_OPTIONS = optionsFrom(APPOINTMENT_STATUS_META);
export const INVOICE_STATUS_OPTIONS = optionsFrom(INVOICE_STATUS_META);
export const PAYMENT_METHOD_OPTIONS = optionsFrom(PAYMENT_METHOD_META);
export const SERVICE_CATEGORY_OPTIONS = optionsFrom(SERVICE_CATEGORY_META);

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

// ---------------------------------------------------------------------------
// Appointment state machine - the single source of truth for which status
// changes the business allows. Used by the service layer and by the UI to
// decide which action buttons to render.
// ---------------------------------------------------------------------------

export const ALLOWED_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  SCHEDULED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_CONSULTATION", "CANCELLED", "NO_SHOW"],
  IN_CONSULTATION: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Statuses that still occupy a slot in the doctor's diary. */
export const BLOCKING_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CHECKED_IN",
  "IN_CONSULTATION",
];

/** Statuses that count as "the visit happened". */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CHECKED_IN",
  "IN_CONSULTATION",
];

export const AVATAR_PALETTE = [
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
];
