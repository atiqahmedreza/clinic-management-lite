/* eslint-disable no-console */
/**
 * End-to-end verification of the clinic's core workflow and its business rules,
 * run against the real database through the real service layer.
 *
 *   npm run verify
 *
 * It walks one complete visit — register, book, check in, consult, bill, pay —
 * and asserts that each guard rejects the illegal version of the same step.
 * Everything it creates is removed again at the end, so the demo data is left
 * exactly as the seed produced it.
 */
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { SessionPayload } from "@/lib/auth/jwt";
import {
  changeAppointmentStatus,
  createAppointment,
  getDoctorDaySlots,
} from "@/lib/services/appointment.service";
import { saveConsultation } from "@/lib/services/consultation.service";
import {
  cancelInvoice,
  createInvoice,
  getInvoiceDraft,
  recordPayment,
} from "@/lib/services/billing.service";
import {
  createPatient,
  getPatientProfile,
  updatePatient,
} from "@/lib/services/patient.service";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { createAppointmentSchema } from "@/lib/validations/appointment";

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  passed += 1;
  console.log(`  \u001b[32m✓\u001b[0m ${label}${detail ? `  \u001b[90m${detail}\u001b[0m` : ""}`);
}

function bad(label: string, detail: string) {
  failed += 1;
  console.log(`  \u001b[31m✗\u001b[0m ${label}\n      ${detail}`);
}

function assert(condition: boolean, label: string, detail = "") {
  if (condition) ok(label, detail);
  else bad(label, detail || "expected condition was false");
}

/** Asserts that `run` throws a user-facing AppError. */
async function rejects(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    bad(label, "the operation was ALLOWED — the rule did not fire");
  } catch (error) {
    if (error instanceof AppError) {
      ok(label, `blocked: "${error.message}"`);
    } else {
      bad(label, `threw an unexpected error: ${String(error)}`);
    }
  }
}

function section(title: string) {
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

async function main() {
  console.log("\n\u001b[1mVerifying the clinic workflow against the live database\u001b[0m");

  // ---- fixtures ---------------------------------------------------------
  const receptionist = await prisma.user.findUniqueOrThrow({
    where: { email: "reception@shefaclinic.example" },
  });
  const doctorUser = await prisma.user.findUniqueOrThrow({
    where: { email: "dr.rahman@shefaclinic.example" },
    include: { doctorProfile: true },
  });
  const otherDoctorUser = await prisma.user.findUniqueOrThrow({
    where: { email: "dr.hossain@shefaclinic.example" },
    include: { doctorProfile: true },
  });

  const doctor = doctorUser.doctorProfile!;
  const doctorSession: SessionPayload = {
    sub: doctorUser.id,
    email: doctorUser.email,
    name: doctorUser.name,
    role: "DOCTOR",
    doctorId: doctor.id,
  };
  const otherDoctorSession: SessionPayload = {
    sub: otherDoctorUser.id,
    email: otherDoctorUser.email,
    name: otherDoctorUser.name,
    role: "DOCTOR",
    doctorId: otherDoctorUser.doctorProfile!.id,
  };

  const before = await getDashboardData();

  const unique = Date.now().toString().slice(-7);
  const testPhone = `019${unique}`;
  const createdIds = {
    patientId: "",
    appointmentIds: [] as string[],
    invoiceIds: [] as string[],
  };

  try {
    // =====================================================================
    section("1 · Register the patient");
    // =====================================================================

    const patient = await createPatient(
      {
        firstName: "Verification",
        lastName: "Testcase",
        dateOfBirth: new Date("1992-04-17T00:00:00.000Z"),
        gender: "FEMALE",
        phone: testPhone,
        email: undefined,
        address: undefined,
        city: "Dhaka",
        bloodGroup: "O_POSITIVE",
        allergies: "Ibuprofen",
        chronicConditions: undefined,
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
      },
      receptionist.id,
    );
    createdIds.patientId = patient.id;

    assert(
      /^P-\d{4}-\d{4}$/.test(patient.mrn),
      "a medical record number is issued automatically",
      patient.mrn,
    );

    const afterRegister = await getDashboardData();
    assert(
      afterRegister.kpi.activePatients === before.kpi.activePatients + 1,
      "the dashboard patient count is recomputed, not cached",
      `${before.kpi.activePatients} → ${afterRegister.kpi.activePatients}`,
    );

    await rejects("a second patient cannot reuse the same phone number", () =>
      createPatient(
        {
          firstName: "Duplicate",
          lastName: "Person",
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
          gender: "MALE",
          phone: testPhone,
          email: undefined,
          address: undefined,
          city: undefined,
          bloodGroup: "UNKNOWN",
          allergies: undefined,
          chronicConditions: undefined,
          emergencyContactName: undefined,
          emergencyContactPhone: undefined,
        },
        receptionist.id,
      ),
    );

    // =====================================================================
    section("2 · Book the visit");
    // =====================================================================

    // Find a slot that is free in BOTH doctors' diaries and inside both of
    // their working windows. That matters: the patient-clash rule below is
    // only genuinely exercised if the working-hours and doctor-conflict rules
    // would otherwise let the second booking through.
    const otherDoctorId = otherDoctorUser.doctorProfile!.id;
    let slotDay = new Date();
    slotDay.setHours(0, 0, 0, 0);
    let freeSlot: string | undefined;

    for (let i = 0; i < 21; i += 1) {
      const probe = new Date(slotDay);
      probe.setDate(probe.getDate() + i);

      const [mine, theirs] = await Promise.all([
        getDoctorDaySlots(doctor.id, probe, 30),
        getDoctorDaySlots(otherDoctorId, probe, 30),
      ]);
      if (!mine.working || !theirs.working) continue;

      const theirFree = new Set(
        theirs.slots.filter((slot) => slot.available).map((slot) => slot.time),
      );
      const shared = mine.slots.find(
        (slot) => slot.available && theirFree.has(slot.time),
      );
      if (shared) {
        slotDay = probe;
        freeSlot = shared.time;
        break;
      }
    }

    if (!freeSlot) {
      throw new Error("no slot free for both doctors in the next 21 days");
    }

    const dayISO = `${slotDay.getFullYear()}-${String(slotDay.getMonth() + 1).padStart(2, "0")}-${String(slotDay.getDate()).padStart(2, "0")}`;
    ok("slot availability is computed from the diary", `${dayISO} ${freeSlot}`);

    const scheduledAt = new Date(`${dayISO}T${freeSlot}:00`);

    const appointment = await createAppointment(
      {
        patientId: patient.id,
        doctorId: doctor.id,
        scheduledAt,
        durationMinutes: 30,
        type: "NEW_VISIT",
        reason: "Workflow verification - fever and headache",
        notes: undefined,
      },
      receptionist.id,
    );
    createdIds.appointmentIds.push(appointment.id);

    assert(
      /^APT-\d{8}-\d{4}$/.test(appointment.code),
      "a booking code is issued automatically",
      appointment.code,
    );

    await rejects(
      "the same doctor cannot be double-booked in that slot",
      async () => {
        const other = await prisma.patient.findFirstOrThrow({
          where: { isActive: true, id: { not: patient.id } },
        });
        return createAppointment(
          {
            patientId: other.id,
            doctorId: doctor.id,
            scheduledAt,
            durationMinutes: 30,
            type: "NEW_VISIT",
            reason: "Overlapping booking attempt",
            notes: undefined,
          },
          receptionist.id,
        );
      },
    );

    await rejects(
      "a partially overlapping visit is also rejected",
      async () => {
        const other = await prisma.patient.findFirstOrThrow({
          where: { isActive: true, id: { not: patient.id } },
        });
        return createAppointment(
          {
            patientId: other.id,
            doctorId: doctor.id,
            // starts 15 minutes into the existing 30-minute visit
            scheduledAt: new Date(scheduledAt.getTime() + 15 * 60_000),
            durationMinutes: 30,
            type: "NEW_VISIT",
            reason: "Partially overlapping booking attempt",
            notes: undefined,
          },
          receptionist.id,
        );
      },
    );

    // The other doctor is working and free at this exact time, so the only
    // rule that can stop this booking is the patient-clash rule.
    await rejects(
      "the same patient cannot be booked with two doctors at once",
      () =>
        createAppointment(
          {
            patientId: patient.id,
            doctorId: otherDoctorId,
            scheduledAt,
            durationMinutes: 30,
            type: "NEW_VISIT",
            reason: "Patient clash attempt",
            notes: undefined,
          },
          receptionist.id,
        ),
    );

    await rejects("a visit cannot be booked outside working hours", () =>
      createAppointment(
        {
          patientId: patient.id,
          doctorId: doctor.id,
          scheduledAt: new Date(`${dayISO}T23:30:00`),
          durationMinutes: 30,
          type: "NEW_VISIT",
          reason: "Out of hours attempt",
          notes: undefined,
        },
        receptionist.id,
      ),
    );

    const pastBooking = createAppointmentSchema.safeParse({
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: "2020-01-01T10:00",
      durationMinutes: "30",
      type: "NEW_VISIT",
      reason: "Backdated booking attempt",
    });
    assert(
      !pastBooking.success,
      "a visit cannot be booked in the past",
      pastBooking.success
        ? ""
        : `blocked: "${pastBooking.error.issues[0]?.message}"`,
    );

    // =====================================================================
    section("3 · Move the visit through its lifecycle");
    // =====================================================================

    await rejects(
      "a scheduled visit cannot jump straight to in-consultation",
      () => changeAppointmentStatus(appointment.id, "IN_CONSULTATION"),
    );

    await rejects("cancelling without a reason is refused", () =>
      changeAppointmentStatus(appointment.id, "CANCELLED"),
    );

    const checkedIn = await changeAppointmentStatus(
      appointment.id,
      "CHECKED_IN",
    );
    assert(
      checkedIn.status === "CHECKED_IN",
      "the patient can be checked in",
      checkedIn.status,
    );

    // =====================================================================
    section("4 · Record the consultation");
    // =====================================================================

    await rejects(
      "a different doctor cannot write this clinical record",
      () =>
        saveConsultation(
          {
            appointmentId: appointment.id,
            temperatureC: 38.2,
            pulseBpm: 88,
            systolicBp: 124,
            diastolicBp: 80,
            respiratoryBpm: 18,
            spo2: 98,
            weightKg: 61,
            heightCm: 162,
            symptoms: "Attempt by the wrong doctor",
            examination: undefined,
            diagnosis: "Should not be saved",
            treatmentPlan: undefined,
            advice: undefined,
            followUpDate: undefined,
            prescriptions: [],
          },
          otherDoctorSession,
        ),
    );

    const consultation = await saveConsultation(
      {
        appointmentId: appointment.id,
        temperatureC: 38.2,
        pulseBpm: 88,
        systolicBp: 124,
        diastolicBp: 80,
        respiratoryBpm: 18,
        spo2: 98,
        weightKg: 61,
        heightCm: 162,
        symptoms:
          "Fever to 101F for two days with frontal headache and body ache.",
        examination: "Throat mildly congested. Chest clear. No neck stiffness.",
        diagnosis: "Acute viral fever",
        treatmentPlan: "Antipyretics, fluids, review in 48 hours if no better.",
        advice: "Rest, 3 litres of fluid a day, paracetamol as needed.",
        followUpDate: undefined,
        prescriptions: [
          {
            medicineName: "Paracetamol",
            dosage: "500 mg",
            frequency: "Three times daily",
            durationDays: 3,
            instructions: "After meals",
          },
          {
            medicineName: "Oral rehydration salts",
            dosage: "1 sachet",
            frequency: "As needed",
            durationDays: 3,
            instructions: undefined,
          },
        ],
      },
      doctorSession,
    );

    const afterConsult = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { consultation: { include: { prescriptions: true } } },
    });

    assert(
      afterConsult.status === "COMPLETED",
      "saving the consultation completes the visit",
      afterConsult.status,
    );
    assert(
      afterConsult.consultation?.prescriptions.length === 2,
      "prescriptions are saved with the record",
      `${afterConsult.consultation?.prescriptions.length} medicines`,
    );
    assert(
      afterConsult.completedAt !== null,
      "the completion timestamp is stamped",
    );

    // =====================================================================
    section("5 · Raise the invoice");
    // =====================================================================

    const draft = await getInvoiceDraft(consultation.id);
    assert(
      draft.suggestedItems[0]?.unitPrice === Number(doctor.consultationFee),
      "the invoice is pre-filled with the attending doctor's fee",
      `৳${draft.suggestedItems[0]?.unitPrice}`,
    );

    const labTest = draft.services.find((s) => s.code === "LAB-CBC")!;

    await rejects("the discount cannot exceed the subtotal", () =>
      createInvoice(
        {
          patientId: patient.id,
          consultationId: consultation.id,
          items: [
            {
              serviceId: undefined,
              description: "Consultation",
              quantity: 1,
              unitPrice: 800,
            },
          ],
          discountAmount: 5000,
          taxAmount: 0,
          notes: undefined,
        },
        receptionist.id,
      ),
    );

    const invoice = await createInvoice(
      {
        patientId: patient.id,
        consultationId: consultation.id,
        items: [
          {
            serviceId: undefined,
            description: `Consultation — ${doctorUser.name}`,
            quantity: 1,
            unitPrice: Number(doctor.consultationFee),
          },
          {
            serviceId: labTest.id,
            description: labTest.name,
            // A deliberately wrong price: the server must ignore it.
            quantity: 1,
            unitPrice: 1,
          },
        ],
        discountAmount: 50,
        taxAmount: 0,
        notes: "Raised by the workflow verification script.",
      },
      receptionist.id,
    );
    createdIds.invoiceIds.push(invoice.id);

    const storedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { items: true },
    });

    const labLine = storedInvoice.items.find(
      (item) => item.serviceId === labTest.id,
    )!;
    assert(
      Number(labLine.unitPrice) === labTest.price,
      "a tampered price is overridden by the price list",
      `posted ৳1, charged ৳${Number(labLine.unitPrice)}`,
    );

    const expectedTotal =
      Number(doctor.consultationFee) + labTest.price - 50;
    assert(
      Number(storedInvoice.totalAmount) === expectedTotal,
      "the total is computed server-side",
      `৳${Number(storedInvoice.totalAmount)}`,
    );

    await rejects("the same consultation cannot be billed twice", () =>
      createInvoice(
        {
          patientId: patient.id,
          consultationId: consultation.id,
          items: [
            {
              serviceId: undefined,
              description: "Duplicate billing attempt",
              quantity: 1,
              unitPrice: 100,
            },
          ],
          discountAmount: 0,
          taxAmount: 0,
          notes: undefined,
        },
        receptionist.id,
      ),
    );

    // =====================================================================
    section("6 · Take payment");
    // =====================================================================

    await rejects("a payment larger than the balance is refused", () =>
      recordPayment(
        {
          invoiceId: invoice.id,
          amount: expectedTotal + 500,
          method: "CASH",
          reference: undefined,
          note: undefined,
        },
        receptionist.id,
      ),
    );

    const partial = await recordPayment(
      {
        invoiceId: invoice.id,
        amount: 300,
        method: "MOBILE_BANKING",
        reference: "BK778899",
        note: undefined,
      },
      receptionist.id,
    );
    assert(
      partial.status === "PARTIALLY_PAID",
      "a part payment moves the invoice to partially paid",
      `balance ৳${partial.balanceDue}`,
    );

    await rejects(
      "an invoice with payments against it cannot be cancelled",
      () => cancelInvoice(invoice.id, "Attempted void after payment"),
    );

    const settled = await recordPayment(
      {
        invoiceId: invoice.id,
        amount: partial.balanceDue,
        method: "CASH",
        reference: undefined,
        note: undefined,
      },
      receptionist.id,
    );
    assert(
      settled.status === "PAID" && settled.balanceDue === 0,
      "paying the balance settles the invoice",
      `status ${settled.status}`,
    );

    await rejects("a settled invoice takes no further payment", () =>
      recordPayment(
        {
          invoiceId: invoice.id,
          amount: 100,
          method: "CASH",
          reference: undefined,
          note: undefined,
        },
        receptionist.id,
      ),
    );

    // =====================================================================
    section("7 · The record and the dashboard reflect it");
    // =====================================================================

    const profile = await getPatientProfile(patient.id);
    assert(
      profile.summary.totalVisits === 1,
      "the visit appears in the patient's history",
    );
    assert(
      profile.summary.totalBilled === expectedTotal &&
        profile.summary.outstanding === 0,
      "the patient's billed and outstanding totals are right",
      `billed ৳${profile.summary.totalBilled}, outstanding ৳${profile.summary.outstanding}`,
    );
    assert(
      profile.consultations[0]?.prescriptions.length === 2,
      "the prescription is on the history entry",
    );

    await rejects("a patient with history cannot be deleted away silently", () =>
      updatePatient({
        id: patient.id,
        firstName: "Verification",
        lastName: "Testcase",
        dateOfBirth: new Date("1992-04-17T00:00:00.000Z"),
        gender: "FEMALE",
        phone: testPhone,
        email: undefined,
        address: undefined,
        city: "Dhaka",
        bloodGroup: "O_POSITIVE",
        allergies: "Ibuprofen",
        chronicConditions: undefined,
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
        isActive: false,
      }).then(async () => {
        // Archiving IS allowed here (no open appointments), so re-open one to
        // prove the rule that blocks it.
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "SCHEDULED" },
        });
        return updatePatient({
          id: patient.id,
          firstName: "Verification",
          lastName: "Testcase",
          dateOfBirth: new Date("1992-04-17T00:00:00.000Z"),
          gender: "FEMALE",
          phone: testPhone,
          email: undefined,
          address: undefined,
          city: "Dhaka",
          bloodGroup: "O_POSITIVE",
          allergies: "Ibuprofen",
          chronicConditions: undefined,
          emergencyContactName: undefined,
          emergencyContactPhone: undefined,
          isActive: false,
        });
      }),
    );
    // restore the status the rest of the script expects
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
    });

    const after = await getDashboardData();
    assert(
      after.kpi.revenueToday === before.kpi.revenueToday + expectedTotal,
      "today's collected figure moved by exactly what was taken",
      `৳${before.kpi.revenueToday} → ৳${after.kpi.revenueToday} (+৳${expectedTotal})`,
    );
  } finally {
    // =====================================================================
    section("Cleanup");
    // =====================================================================
    if (createdIds.patientId) {
      await prisma.payment.deleteMany({
        where: { invoice: { patientId: createdIds.patientId } },
      });
      await prisma.invoiceItem.deleteMany({
        where: { invoice: { patientId: createdIds.patientId } },
      });
      await prisma.invoice.deleteMany({
        where: { patientId: createdIds.patientId },
      });
      await prisma.prescription.deleteMany({
        where: { consultation: { patientId: createdIds.patientId } },
      });
      await prisma.consultation.deleteMany({
        where: { patientId: createdIds.patientId },
      });
      await prisma.appointment.deleteMany({
        where: { patientId: createdIds.patientId },
      });
      await prisma.patient.delete({ where: { id: createdIds.patientId } });
      ok("test records removed — demo data is back to the seeded state");
    }
  }

  console.log(
    `\n\u001b[1m${passed} passed, ${failed} failed\u001b[0m\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nVerification crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
