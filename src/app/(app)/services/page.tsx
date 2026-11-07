import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, Tags } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { listServices } from "@/lib/services/billing.service";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/constants";
import { formatCurrency, readParam, type SearchParamsInput } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge, ServiceCategoryBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  ClearFilters,
  FilterBar,
  FilterSelect,
  SearchInput,
} from "@/components/ui/filters";
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
import { ServiceForm } from "@/components/billing/service-form";

export const metadata: Metadata = { title: "Price list" };
export const dynamic = "force-dynamic";

export default async function ServicesPage({
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
          description="The clinic price list is maintained by an administrator account."
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
  const category = readParam(params, "category");
  const editId = readParam(params, "edit");

  const services = await listServices({
    search,
    category,
    includeInactive: true,
  });

  const editing = editId
    ? services.find((service) => service.id === editId)
    : undefined;

  const filtered = Boolean(search || category);

  return (
    <>
      <PageHeader
        title="Price list"
        description="Everything the front desk can charge for. Prices are re-read from here when an invoice is saved, so a tampered form cannot change what a service costs."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <FilterBar>
            <SearchInput placeholder="Search name or code…" label="Search services" />
            <FilterSelect
              paramName="category"
              label="Filter by category"
              allLabel="All categories"
              options={SERVICE_CATEGORY_OPTIONS}
            />
            <ClearFilters keys={["q", "category"]} />
            <span className="ml-auto hidden text-sm text-ink-muted sm:block">
              {services.length} {services.length === 1 ? "service" : "services"}
            </span>
          </FilterBar>

          {services.length === 0 ? (
            <EmptyState
              icon={<Tags className="h-5 w-5" aria-hidden />}
              title={filtered ? "No services match" : "The price list is empty"}
              description={
                filtered
                  ? "Try a different search, or clear the filters."
                  : "Add the clinic's billable services using the form beside this list."
              }
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Service</TH>
                      <TH>Category</TH>
                      <TH align="right">Price</TH>
                      <TH>Status</TH>
                      <TH align="right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {services.map((service) => (
                      <TR key={service.id}>
                        <TD>
                          <span className="block font-medium text-ink">
                            {service.name}
                          </span>
                          <span className="tabular block text-xs text-ink-muted">
                            {service.code}
                          </span>
                        </TD>
                        <TD>
                          <ServiceCategoryBadge category={service.category} />
                        </TD>
                        <TD align="right" className="tabular font-medium">
                          {formatCurrency(service.price)}
                        </TD>
                        <TD>
                          {service.isActive ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="neutral">Retired</Badge>
                          )}
                        </TD>
                        <TD align="right">
                          <Link
                            href={`/services?edit=${service.id}`}
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
                {services.map((service) => (
                  <MobileRow key={service.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {service.name}
                        </p>
                        <p className="tabular text-xs text-ink-muted">
                          {service.code}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <ServiceCategoryBadge category={service.category} />
                          {service.isActive ? null : (
                            <Badge tone="neutral">Retired</Badge>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular font-semibold text-ink">
                          {formatCurrency(service.price)}
                        </p>
                        <Link
                          href={`/services?edit=${service.id}`}
                          scroll={false}
                          className="mt-1 inline-block text-xs font-medium text-brand-ink"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </MobileRow>
                ))}
              </MobileList>
            </>
          )}
        </Card>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <ServiceForm
            key={editing?.id ?? "new"}
            defaults={
              editing
                ? {
                    id: editing.id,
                    code: editing.code,
                    name: editing.name,
                    category: editing.category,
                    price: editing.price,
                    description: editing.description,
                    isActive: editing.isActive,
                  }
                : undefined
            }
          />
          {editing ? (
            <Link
              href="/services"
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
