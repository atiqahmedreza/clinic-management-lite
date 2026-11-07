import {
  CalendarDays,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that may see the link. Admins always see everything. */
  roles?: Role[];
  description?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Clinic",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Today at a glance",
      },
      {
        href: "/appointments",
        label: "Appointments",
        icon: CalendarDays,
        description: "Diary and queue",
      },
      {
        href: "/patients",
        label: "Patients",
        icon: Users,
        description: "Registry and visit history",
      },
      {
        href: "/consultations",
        label: "Consultations",
        icon: Stethoscope,
        description: "Clinical records",
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        href: "/invoices",
        label: "Invoices",
        icon: ReceiptText,
        roles: ["RECEPTIONIST"],
        description: "Bills and payments",
      },
      {
        href: "/services",
        label: "Price list",
        icon: Tags,
        roles: [],
        description: "Billable services",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/doctors",
        label: "Doctors",
        icon: Settings2,
        description: "Profiles and availability",
      },
      {
        href: "/staff",
        label: "Staff accounts",
        icon: ShieldCheck,
        roles: [],
        description: "Logins and permissions",
      },
    ],
  },
];

/** Filters the navigation for a role. An empty `roles` array means admin-only. */
export function navForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.roles) return true;
      if (role === "ADMIN") return true;
      return item.roles.includes(role);
    }),
  })).filter((section) => section.items.length > 0);
}
