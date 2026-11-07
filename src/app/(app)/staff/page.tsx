import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getStaffMember, listStaff } from "@/lib/services/staff.service";
import { formatCurrency, formatRelative, readParam, type SearchParamsInput } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, RoleBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { FilterBar, SearchInput } from "@/components/ui/filters";
import {
  MobileList,
  MobileRow,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { StaffForm } from "@/components/staff/staff-form";

export const metadata: Metadata = { title: "Staff accounts" };
export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireSession();

  if (session.role !== "ADMIN") {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Administrators only"
          description="Staff logins and permissions are managed by an administrator account."
          action={
            <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
              Back to dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const params = await searchParams;
  const search = readParam(params, "q");
  const editId = readParam(params, "edit");

  const [staff, editing] = await Promise.all([
    listStaff(search),
    editId ? getStaffMember(editId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Who can sign in, and what each role is allowed to do. The clinic must always keep at least one active administrator."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <FilterBar>
            <SearchInput placeholder="Search name or email…" label="Search staff" />
            <span className="ml-auto hidden text-sm text-ink-muted sm:block">
              {staff.length} {staff.length === 1 ? "account" : "accounts"}
            </span>
          </FilterBar>

          {staff.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              title="No accounts match"
              description="Try a different search term."
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Person</TH>
                      <TH>Role</TH>
                      <TH>Clinical profile</TH>
                      <TH>Last sign-in</TH>
                      <TH align="right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {staff.map((member) => (
                      <TR key={member.id}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={member.name} size="sm" />
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-ink">
                                {member.name}
                              </span>
                              <span className="block truncate text-xs text-ink-muted">
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <RoleBadge role={member.role} />
                            {member.isActive ? null : (
                              <Badge tone="neutral">Disabled</Badge>
                            )}
                          </div>
                        </TD>
                        <TD>
                          {member.doctorProfile ? (
                            <>
                              <span className="block text-ink-secondary">
                                {member.doctorProfile.specialization}
                              </span>
                              <span className="tabular block text-xs text-ink-muted">
                                {formatCurrency(
                                  member.doctorProfile.consultationFee,
                                )}{" "}
                                per visit
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap text-ink-muted">
                          {member.lastLoginAt
                            ? formatRelative(member.lastLoginAt)
                            : "Never"}
                        </TD>
                        <TD align="right">
                          <Link
                            href={`/staff?edit=${member.id}`}
                            scroll={false}
                            className={buttonClasses("secondary", "sm")}
                          >
                            Edit
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>

              <MobileList>
                {staff.map((member) => (
                  <MobileRow key={member.id}>
                    <div className="flex items-start gap-3">
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {member.email}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <RoleBadge role={member.role} />
                          {member.isActive ? null : (
                            <Badge tone="neutral">Disabled</Badge>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/staff?edit=${member.id}`}
                        scroll={false}
                        className="shrink-0 text-xs font-medium text-brand-ink"
                      >
                        Edit
                      </Link>
                    </div>
                  </MobileRow>
                ))}
              </MobileList>
            </>
          )}
        </Card>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <StaffForm
            key={editing?.id ?? "new"}
            defaults={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    email: editing.email,
                    phone: editing.phone,
                    role: editing.role,
                    isActive: editing.isActive,
                    doctor: editing.doctorProfile
                      ? {
                          specialization: editing.doctorProfile.specialization,
                          qualifications: editing.doctorProfile.qualifications,
                          licenseNumber: editing.doctorProfile.licenseNumber,
                          consultationFee:
                            editing.doctorProfile.consultationFee,
                          roomNumber: editing.doctorProfile.roomNumber,
                          bio: editing.doctorProfile.bio,
                          availableDays: editing.doctorProfile.availableDays,
                          startTime: editing.doctorProfile.startTime,
                          endTime: editing.doctorProfile.endTime,
                          slotMinutes: editing.doctorProfile.slotMinutes,
                          isAcceptingPatients:
                            editing.doctorProfile.isAcceptingPatients,
                        }
                      : null,
                  }
                : undefined
            }
          />
          {editing ? (
            <Link
              href="/staff"
              scroll={false}
              className={buttonClasses("ghost", "md", "mt-2 w-full")}
            >
              Stop editing
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
