"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LogIn,
  Stethoscope,
  UserX,
  XCircle,
} from "lucide-react";
import type { AppointmentStatus, Role } from "@prisma/client";

import { changeAppointmentStatusAction } from "@/actions/appointment.actions";
import { startConsultationAction } from "@/actions/consultation.actions";
import { ALLOWED_STATUS_TRANSITIONS } from "@/lib/constants";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cancelAppointmentAction } from "@/actions/appointment.actions";

type Props = {
  appointmentId: string;
  status: AppointmentStatus;
  /** The doctor profile this visit belongs to, for the doctor-only actions. */
  doctorId: string;
  viewer: { role: Role; doctorId?: string };
  size?: "sm" | "md";
  layout?: "row" | "stack";
};

/**
 * Renders exactly the transitions the state machine allows from the current
 * status, filtered by what this role is allowed to do. The same component
 * serves the dashboard queue, the appointment list and the detail page.
 */
export function AppointmentStatusActions({
  appointmentId,
  status,
  doctorId,
  viewer,
  size = "sm",
  layout = "row",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<AppointmentStatus | "START" | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const allowed = ALLOWED_STATUS_TRANSITIONS[status];
  const isAdmin = viewer.role === "ADMIN";
  const isFrontDesk = isAdmin || viewer.role === "RECEPTIONIST";
  // Admins may stand in for the attending doctor — the consultation page and
  // the service layer both allow it, so the button has to be there too.
  const isAttendingDoctor =
    isAdmin || (viewer.role === "DOCTOR" && viewer.doctorId === doctorId);

  const run = async (next: AppointmentStatus) => {
    setPending(next);
    const result = await changeAppointmentStatusAction(appointmentId, next);
    setPending(null);
    if (result.ok) {
      toast.success(result.message ?? "Visit updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const startConsultation = async () => {
    setPending("START");
    const result = await startConsultationAction(appointmentId);
    setPending(null);
    if (result.ok) {
      router.push(`/appointments/${appointmentId}/consult`);
    } else {
      toast.error(result.error);
    }
  };

  const confirmCancel = async () => {
    setCancelError(null);
    const formData = new FormData();
    formData.set("id", appointmentId);
    formData.set("cancellationReason", cancelReason);

    setPending("CANCELLED");
    const result = await cancelAppointmentAction(null, formData);
    setPending(null);

    if (result?.ok) {
      setCancelOpen(false);
      setCancelReason("");
      toast.success(result.message ?? "Visit cancelled.");
      router.refresh();
    } else {
      setCancelError(result?.error ?? "Could not cancel this visit.");
    }
  };

  const buttons: React.ReactNode[] = [];

  if (allowed.includes("CHECKED_IN") && isFrontDesk) {
    buttons.push(
      <Button
        key="check-in"
        size={size}
        variant="primary"
        loading={pending === "CHECKED_IN"}
        disabled={pending !== null}
        onClick={() => run("CHECKED_IN")}
        icon={<LogIn className="h-3.5 w-3.5" aria-hidden />}
      >
        Check in
      </Button>,
    );
  }

  if (status === "CHECKED_IN" && isAttendingDoctor) {
    buttons.push(
      <Button
        key="start"
        size={size}
        variant="primary"
        loading={pending === "START"}
        disabled={pending !== null}
        onClick={startConsultation}
        icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
      >
        Start consultation
      </Button>,
    );
  }

  if (status === "IN_CONSULTATION" && isAttendingDoctor) {
    buttons.push(
      <Button
        key="resume"
        size={size}
        variant="primary"
        disabled={pending !== null}
        onClick={() => router.push(`/appointments/${appointmentId}/consult`)}
        icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
      >
        Resume consultation
      </Button>,
    );
  }

  if (allowed.includes("NO_SHOW") && isFrontDesk) {
    buttons.push(
      <Button
        key="no-show"
        size={size}
        variant="ghost"
        loading={pending === "NO_SHOW"}
        disabled={pending !== null}
        onClick={() => run("NO_SHOW")}
        icon={<UserX className="h-3.5 w-3.5" aria-hidden />}
      >
        No show
      </Button>,
    );
  }

  if (allowed.includes("CANCELLED") && isFrontDesk) {
    buttons.push(
      <Button
        key="cancel"
        size={size}
        variant="ghost"
        disabled={pending !== null}
        onClick={() => setCancelOpen(true)}
        icon={<XCircle className="h-3.5 w-3.5" aria-hidden />}
      >
        Cancel
      </Button>,
    );
  }

  if (buttons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        {status === "COMPLETED" ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Visit closed
          </>
        ) : (
          "No actions available"
        )}
      </span>
    );
  }

  return (
    <>
      <div
        className={
          layout === "stack"
            ? "flex flex-col gap-2"
            : "flex flex-wrap items-center gap-1.5"
        }
      >
        {buttons}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelError(null);
        }}
        onConfirm={confirmCancel}
        loading={pending === "CANCELLED"}
        title="Cancel this visit?"
        confirmLabel="Cancel visit"
        message="The slot is released back into the doctor's diary. This cannot be undone — rebooking creates a new visit."
      >
        <Field
          label="Reason"
          htmlFor="cancellationReason"
          required
          error={cancelError ?? undefined}
        >
          <Textarea
            id="cancellationReason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Patient called to postpone…"
            rows={3}
            invalid={Boolean(cancelError)}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}

export function statusActionVariant(status: AppointmentStatus): ButtonVariant {
  return status === "SCHEDULED" ? "primary" : "secondary";
}
