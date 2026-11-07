import Link from "next/link";
import type { Metadata } from "next";
import { Phone, UserPlus, Users } from "lucide-react";
import type { Gender } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { listPatients } from "@/lib/services/patient.service";
import { BLOOD_GROUP_META, GENDER_OPTIONS, PAGE_SIZE } from "@/lib/constants";
import {
  describeAge,
  formatDate,
  readPage,
  readParam,
  type SearchParamsInput,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, GenderBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  ClearFilters,
  FilterBar,
  FilterSelect,
  SearchInput,
} from "@/components/ui/filters";
import { Pagination } from "@/components/ui/pagination";
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

export const metadata: Metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  await requireSession();
  const params = await searchParams;

  const search = readParam(params, "q");
  const gender = readParam(params, "gender") as Gender | undefined;
  const status = (readParam(params, "status") ?? "active") as
    | "active"
    | "inactive"
    | "all";
  const page = readPage(params);

  const { rows, total, pageCount } = await listPatients({
    search,
    gender,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtered = Boolean(search || gender || readParam(params, "status"));

  return (
    <>
      <PageHeader
        title="Patients"
        description="Everyone registered at the clinic, with their full visit history."
        actions={
          <Link href="/patients/new" className={buttonClasses("primary", "md")}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Register patient
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            placeholder="Search name, MRN, phone or email…"
            label="Search patients"
          />
          <FilterSelect
            paramName="gender"
            label="Filter by gender"
            allLabel="All genders"
            options={GENDER_OPTIONS}
          />
          <FilterSelect
            paramName="status"
            label="Filter by record status"
            allLabel="Active only"
            options={[
              { value: "all", label: "Active + archived" },
              { value: "inactive", label: "Archived only" },
            ]}
          />
          <ClearFilters keys={["q", "gender", "status"]} />
          <span className="ml-auto hidden text-sm text-ink-muted sm:block">
            {total} {total === 1 ? "patient" : "patients"}
          </span>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden />}
            title={filtered ? "No patients match those filters" : "No patients yet"}
            description={
              filtered
                ? "Try a different spelling, or clear the filters to see the whole registry."
                : "Register the first patient to start the workflow: register → book → consult → bill."
            }
            action={
              filtered ? (
                <Link href="/patients" className={buttonClasses("secondary", "md")}>
                  Clear filters
                </Link>
              ) : (
                <Link href="/patients/new" className={buttonClasses("primary", "md")}>
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Register patient
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* -------- desktop table -------- */}
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Patient</TH>
                    <TH>MRN</TH>
                    <TH>Contact</TH>
                    <TH>Age / gender</TH>
                    <TH align="center">Visits</TH>
                    <TH>Registered</TH>
                    <TH align="right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((patient) => (
                    <TR key={patient.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${patient.firstName} ${patient.lastName}`}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/patients/${patient.id}`}
                              className="block truncate font-medium text-ink hover:text-brand-ink hover:underline"
                            >
                              {patient.firstName} {patient.lastName}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {patient.bloodGroup !== "UNKNOWN" ? (
                                <span className="text-xs text-ink-muted">
                                  Blood {BLOOD_GROUP_META[patient.bloodGroup]}
                                </span>
                              ) : null}
                              {!patient.isActive ? (
                                <Badge tone="neutral">Archived</Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD className="tabular whitespace-nowrap text-ink-secondary">
                        {patient.mrn}
                      </TD>
                      <TD>
                        <span className="tabular whitespace-nowrap text-ink-secondary">
                          {patient.phone}
                        </span>
                        {patient.city ? (
                          <span className="block text-xs text-ink-muted">
                            {patient.city}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-ink-secondary">
                            {describeAge(patient.dateOfBirth)}
                          </span>
                          <GenderBadge gender={patient.gender} />
                        </div>
                      </TD>
                      <TD align="center" className="tabular text-ink-secondary">
                        {patient._count.consultations}
                      </TD>
                      <TD className="whitespace-nowrap text-ink-muted">
                        {formatDate(patient.createdAt)}
                      </TD>
                      <TD align="right">
                        <Link
                          href={`/patients/${patient.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          Open
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            {/* -------- mobile list -------- */}
            <MobileList>
              {rows.map((patient) => (
                <MobileRow key={patient.id}>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex items-start gap-3"
                  >
                    <Avatar
                      name={`${patient.firstName} ${patient.lastName}`}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="tabular mt-0.5 truncate text-xs text-ink-muted">
                        {patient.mrn} · {describeAge(patient.dateOfBirth)}
                      </p>
                      <p className="tabular mt-1 flex items-center gap-1 text-xs text-ink-secondary">
                        <Phone className="h-3 w-3" aria-hidden />
                        {patient.phone}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <GenderBadge gender={patient.gender} />
                        <Badge tone="neutral">
                          {patient._count.consultations} visit
                          {patient._count.consultations === 1 ? "" : "s"}
                        </Badge>
                        {!patient.isActive ? (
                          <Badge tone="neutral">Archived</Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </MobileRow>
              ))}
            </MobileList>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              basePath="/patients"
              searchParams={params}
              label="patients"
            />
          </>
        )}
      </Card>
    </>
  );
}
