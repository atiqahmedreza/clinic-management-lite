/* eslint-disable no-console */
/**
 * Seeds the clinic with realistic demo data so that every dashboard figure,
 * list and chart has something true to show.
 *
 *   npm run db:seed
 *
 * The generator is deterministic (fixed PRNG seed), so the same data comes
 * back on every run and screenshots stay reproducible.
 */
import {
  AppointmentStatus,
  AppointmentType,
  BloodGroup,
  Gender,
  PaymentMethod,
  PrismaClient,
  ServiceCategory,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Passw0rd!";

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261108);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pickSome<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function intBetween(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Date helpers (clinic-local time)
// ---------------------------------------------------------------------------

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function at(day: Date, minutesFromMidnight: number): Date {
  const result = new Date(day);
  result.setHours(
    Math.floor(minutesFromMidnight / 60),
    minutesFromMidnight % 60,
    0,
    0,
  );
  return result;
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function stamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Guarantees the demo works on whatever day it is seeded.
 *
 * Each doctor has a designed weekly pattern, but if today is one of their days
 * off there would be no queue to demonstrate — and the README sends reviewers
 * straight to a doctor account. So today's weekday is always folded in.
 */
function withToday(days: number[]): number[] {
  const today = isoWeekday(TODAY);
  return days.includes(today)
    ? days
    : [...days, today].sort((a, b) => a - b);
}

function dateOfBirth(ageYears: number, monthOffset: number): Date {
  const date = new Date(
    Date.UTC(TODAY.getFullYear() - ageYears, monthOffset % 12, ((monthOffset * 7) % 27) + 1),
  );
  return date;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const SERVICES: {
  code: string;
  name: string;
  category: ServiceCategory;
  price: number;
  description?: string;
}[] = [
  { code: "CONS-GEN", name: "General consultation", category: "CONSULTATION", price: 800 },
  { code: "CONS-FUP", name: "Follow-up consultation", category: "CONSULTATION", price: 500 },
  { code: "CONS-SPEC", name: "Specialist consultation", category: "CONSULTATION", price: 1200 },
  { code: "LAB-CBC", name: "Complete blood count", category: "LAB_TEST", price: 450, description: "CBC with ESR" },
  { code: "LAB-RBS", name: "Random blood sugar", category: "LAB_TEST", price: 150 },
  { code: "LAB-URINE", name: "Urine routine examination", category: "LAB_TEST", price: 250 },
  { code: "LAB-LFT", name: "Liver function test", category: "LAB_TEST", price: 1200 },
  { code: "LAB-TSH", name: "Thyroid profile (TSH)", category: "LAB_TEST", price: 900 },
  { code: "LAB-LIPID", name: "Lipid profile", category: "LAB_TEST", price: 1100 },
  { code: "PROC-ECG", name: "Electrocardiogram (ECG)", category: "PROCEDURE", price: 600 },
  { code: "PROC-NEB", name: "Nebulisation", category: "PROCEDURE", price: 250 },
  { code: "PROC-DRESS", name: "Wound dressing", category: "PROCEDURE", price: 300 },
  { code: "PROC-INJ", name: "Injection administration", category: "PROCEDURE", price: 150 },
  { code: "MED-DISP", name: "Pharmacy dispensing fee", category: "MEDICATION", price: 50 },
  { code: "OTH-CERT", name: "Medical certificate", category: "OTHER", price: 200 },
];

const PATIENTS: {
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  phone: string;
  bloodGroup: BloodGroup;
  city: string;
  address: string;
  allergies?: string;
  chronicConditions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  email?: string;
}[] = [
  { firstName: "Ayesha", lastName: "Siddiqua", gender: "FEMALE", age: 34, phone: "01711000101", bloodGroup: "B_POSITIVE", city: "Dhaka", address: "House 14, Road 7, Dhanmondi", allergies: "Penicillin", emergencyContactName: "Kamrul Siddiqua", emergencyContactPhone: "01711000102", email: "ayesha.s@example.com" },
  { firstName: "Mahmudul", lastName: "Hasan", gender: "MALE", age: 47, phone: "01711000103", bloodGroup: "O_POSITIVE", city: "Dhaka", address: "Flat 4B, Shantinagar", chronicConditions: "Type 2 diabetes, hypertension", emergencyContactName: "Rumana Hasan", emergencyContactPhone: "01711000104" },
  { firstName: "Tasnim", lastName: "Nawar", gender: "FEMALE", age: 6, phone: "01711000105", bloodGroup: "A_POSITIVE", city: "Dhaka", address: "House 22, Uttara Sector 7", emergencyContactName: "Shamima Nawar", emergencyContactPhone: "01711000106" },
  { firstName: "Rafiqul", lastName: "Islam", gender: "MALE", age: 62, phone: "01711000107", bloodGroup: "AB_POSITIVE", city: "Narayanganj", address: "Masdair, Fatullah", chronicConditions: "Chronic kidney disease stage 2", allergies: "Sulfa drugs" },
  { firstName: "Nusrat", lastName: "Chowdhury", gender: "FEMALE", age: 28, phone: "01711000108", bloodGroup: "O_NEGATIVE", city: "Dhaka", address: "Road 11, Banani", email: "nusrat.c@example.com" },
  { firstName: "Shakib", lastName: "Mahmud", gender: "MALE", age: 19, phone: "01711000109", bloodGroup: "B_POSITIVE", city: "Dhaka", address: "Mirpur DOHS" },
  { firstName: "Farzana", lastName: "Akter", gender: "FEMALE", age: 41, phone: "01711000110", bloodGroup: "A_NEGATIVE", city: "Gazipur", address: "Tongi Bazar", chronicConditions: "Hypothyroidism" },
  { firstName: "Imtiaz", lastName: "Ahmed", gender: "MALE", age: 55, phone: "01711000111", bloodGroup: "O_POSITIVE", city: "Dhaka", address: "Gulshan 2, Road 54", chronicConditions: "Hypertension", emergencyContactName: "Sabina Ahmed", emergencyContactPhone: "01711000112" },
  { firstName: "Rubina", lastName: "Parveen", gender: "FEMALE", age: 37, phone: "01711000113", bloodGroup: "B_NEGATIVE", city: "Dhaka", address: "Mohammadpur, Tajmahal Road" },
  { firstName: "Arif", lastName: "Hossain", gender: "MALE", age: 9, phone: "01711000114", bloodGroup: "A_POSITIVE", city: "Dhaka", address: "Bashundhara R/A, Block C", allergies: "Dust mites", emergencyContactName: "Jahangir Hossain", emergencyContactPhone: "01711000115" },
  { firstName: "Sadia", lastName: "Rahman", gender: "FEMALE", age: 24, phone: "01711000116", bloodGroup: "AB_NEGATIVE", city: "Dhaka", address: "Lalmatia Block B", email: "sadia.r@example.com" },
  { firstName: "Kamal", lastName: "Uddin", gender: "MALE", age: 68, phone: "01711000117", bloodGroup: "O_POSITIVE", city: "Dhaka", address: "Jatrabari, Dholpur", chronicConditions: "Osteoarthritis, hypertension" },
  { firstName: "Mitu", lastName: "Barua", gender: "FEMALE", age: 31, phone: "01711000118", bloodGroup: "A_POSITIVE", city: "Chattogram", address: "Nasirabad Housing Society" },
  { firstName: "Tanvir", lastName: "Chowdhury", gender: "MALE", age: 29, phone: "01711000119", bloodGroup: "B_POSITIVE", city: "Dhaka", address: "Baridhara DOHS" },
  { firstName: "Shirin", lastName: "Sultana", gender: "FEMALE", age: 52, phone: "01711000120", bloodGroup: "O_NEGATIVE", city: "Dhaka", address: "Khilgaon Taltola", chronicConditions: "Type 2 diabetes" },
  { firstName: "Nabila", lastName: "Jahan", gender: "FEMALE", age: 3, phone: "01711000121", bloodGroup: "UNKNOWN", city: "Dhaka", address: "Rampura TV Road", emergencyContactName: "Rezaul Jahan", emergencyContactPhone: "01711000122" },
  { firstName: "Abdullah", lastName: "Al Mamun", gender: "MALE", age: 44, phone: "01711000123", bloodGroup: "A_POSITIVE", city: "Savar", address: "Savar Bazar Road" },
  { firstName: "Priya", lastName: "Das", gender: "FEMALE", age: 22, phone: "01711000124", bloodGroup: "B_POSITIVE", city: "Dhaka", address: "Shantinagar, Chamelibagh", email: "priya.d@example.com" },
];

type Complaint = {
  reason: string;
  symptoms: string;
  examination: string;
  diagnosis: string;
  treatmentPlan: string;
  advice: string;
  medicines: { medicineName: string; dosage: string; frequency: string; durationDays: number; instructions?: string }[];
  labs: string[];
};

const COMPLAINTS: Complaint[] = [
  {
    reason: "Fever and sore throat for three days",
    symptoms: "Fever up to 102°F for three days, sore throat, difficulty swallowing, mild headache.",
    examination: "Throat congested, tonsils enlarged grade II, no exudate. Chest clear on auscultation.",
    diagnosis: "Acute pharyngitis",
    treatmentPlan: "Oral antibiotics for 5 days, antipyretic as needed, warm saline gargle.",
    advice: "Plenty of fluids, rest, avoid cold drinks. Return if fever persists beyond 48 hours.",
    medicines: [
      { medicineName: "Amoxicillin", dosage: "500 mg", frequency: "Three times daily", durationDays: 5, instructions: "After meals" },
      { medicineName: "Paracetamol", dosage: "500 mg", frequency: "As needed", durationDays: 3, instructions: "Maximum 4 doses a day" },
    ],
    labs: ["LAB-CBC"],
  },
  {
    reason: "Routine diabetes review",
    symptoms: "No new complaints. Reports occasional tiredness in the afternoon. Compliant with medication.",
    examination: "BP controlled, no pedal oedema, foot examination normal, no neuropathy.",
    diagnosis: "Type 2 diabetes mellitus — stable on current therapy",
    treatmentPlan: "Continue metformin. Repeat fasting sugar in three months.",
    advice: "Keep to the diet plan, 30 minutes walking daily, monitor sugar twice a week.",
    medicines: [
      { medicineName: "Metformin", dosage: "850 mg", frequency: "Twice daily", durationDays: 90, instructions: "With meals" },
    ],
    labs: ["LAB-RBS", "LAB-LIPID"],
  },
  {
    reason: "Persistent dry cough at night",
    symptoms: "Dry cough for two weeks, worse at night, no fever, mild chest tightness.",
    examination: "Bilateral scattered rhonchi, no crepitations. SpO2 normal on room air.",
    diagnosis: "Cough-variant asthma",
    treatmentPlan: "Inhaled bronchodilator, short course of oral steroid, review in two weeks.",
    advice: "Avoid dust and smoke. Use the inhaler with a spacer.",
    medicines: [
      { medicineName: "Salbutamol inhaler", dosage: "2 puffs", frequency: "Three times daily", durationDays: 14 },
      { medicineName: "Montelukast", dosage: "10 mg", frequency: "At bedtime", durationDays: 14 },
    ],
    labs: [],
  },
  {
    reason: "Headache and dizziness",
    symptoms: "Throbbing headache for five days, dizziness on standing, disturbed sleep.",
    examination: "BP 158/96 mmHg on two readings. CNS examination normal, fundi normal.",
    diagnosis: "Stage 1 hypertension",
    treatmentPlan: "Start antihypertensive, home BP monitoring, review in four weeks.",
    advice: "Reduce salt intake, regular exercise, record BP every morning.",
    medicines: [
      { medicineName: "Amlodipine", dosage: "5 mg", frequency: "Once daily", durationDays: 30, instructions: "In the morning" },
    ],
    labs: ["PROC-ECG", "LAB-LIPID"],
  },
  {
    reason: "Child with loose motions since yesterday",
    symptoms: "Six episodes of watery stool since yesterday, one vomit, taking fluids reasonably well.",
    examination: "Alert, mild dehydration, abdomen soft and non-tender, skin turgor adequate.",
    diagnosis: "Acute gastroenteritis with mild dehydration",
    treatmentPlan: "Oral rehydration, zinc supplement for 10 days, continue feeding.",
    advice: "ORS after each loose stool. Return immediately if the child becomes drowsy or stops passing urine.",
    medicines: [
      { medicineName: "ORS sachet", dosage: "1 sachet", frequency: "As needed", durationDays: 3, instructions: "Dissolve in 500 ml water" },
      { medicineName: "Zinc syrup", dosage: "10 mg", frequency: "Once daily", durationDays: 10 },
    ],
    labs: [],
  },
  {
    reason: "Itchy rash on both forearms",
    symptoms: "Itchy red rash on both forearms for ten days, worse after sun exposure.",
    examination: "Erythematous papular rash on extensor surfaces, no vesicles, no secondary infection.",
    diagnosis: "Allergic contact dermatitis",
    treatmentPlan: "Topical steroid twice daily for one week, oral antihistamine at night.",
    advice: "Avoid the suspected detergent, use a fragrance-free moisturiser twice a day.",
    medicines: [
      { medicineName: "Mometasone cream", dosage: "Thin layer", frequency: "Twice daily", durationDays: 7, instructions: "Apply to affected area only" },
      { medicineName: "Cetirizine", dosage: "10 mg", frequency: "At bedtime", durationDays: 7 },
    ],
    labs: [],
  },
  {
    reason: "Burning sensation while passing urine",
    symptoms: "Burning micturition for four days, increased frequency, mild lower abdominal discomfort.",
    examination: "Suprapubic tenderness present, no renal angle tenderness, afebrile.",
    diagnosis: "Uncomplicated urinary tract infection",
    treatmentPlan: "Antibiotic for five days, increase fluid intake, review if symptoms persist.",
    advice: "Drink at least three litres of water daily. Complete the full course.",
    medicines: [
      { medicineName: "Nitrofurantoin", dosage: "100 mg", frequency: "Twice daily", durationDays: 5, instructions: "After food" },
    ],
    labs: ["LAB-URINE"],
  },
  {
    reason: "Knee pain climbing stairs",
    symptoms: "Bilateral knee pain for six months, worse climbing stairs, morning stiffness under 15 minutes.",
    examination: "Crepitus on both knees, mild effusion on the right, range of movement preserved.",
    diagnosis: "Osteoarthritis of both knees",
    treatmentPlan: "Analgesia, quadriceps strengthening exercises, weight reduction.",
    advice: "Avoid squatting and stair climbing where possible. Physiotherapy referral given.",
    medicines: [
      { medicineName: "Naproxen", dosage: "250 mg", frequency: "Twice daily", durationDays: 10, instructions: "After meals" },
      { medicineName: "Calcium + Vitamin D3", dosage: "1 tablet", frequency: "Once daily", durationDays: 60 },
    ],
    labs: [],
  },
  {
    reason: "Tiredness and weight gain",
    symptoms: "Progressive tiredness for three months, 4 kg weight gain, cold intolerance, dry skin.",
    examination: "Pulse 58/min, dry skin, no goitre palpable, delayed ankle reflex relaxation.",
    diagnosis: "Suspected hypothyroidism — awaiting thyroid profile",
    treatmentPlan: "Thyroid profile today, start levothyroxine once confirmed, review with the report.",
    advice: "Take the tablet on an empty stomach, 30 minutes before breakfast.",
    medicines: [
      { medicineName: "Levothyroxine", dosage: "50 mcg", frequency: "Once daily", durationDays: 30, instructions: "Empty stomach, before breakfast" },
    ],
    labs: ["LAB-TSH", "LAB-CBC"],
  },
  {
    reason: "Dressing change for a healing wound",
    symptoms: "Follow-up for a laceration on the left shin sustained ten days ago.",
    examination: "Wound edges apposed, healthy granulation tissue, no discharge or surrounding cellulitis.",
    diagnosis: "Healing laceration, left shin",
    treatmentPlan: "Dressing changed today. Sutures to be removed in three days.",
    advice: "Keep the dressing dry. Return earlier if there is redness, swelling or discharge.",
    medicines: [],
    labs: ["PROC-DRESS"],
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("→ Clearing existing data…");
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.service.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // ---- staff ----------------------------------------------------------
  console.log("→ Creating staff accounts…");

  const admin = await prisma.user.create({
    data: {
      email: "admin@shefaclinic.example",
      name: "Tanvir Alam",
      passwordHash,
      role: "ADMIN",
      phone: "01711000001",
      lastLoginAt: addDays(TODAY, -1),
    },
  });

  const receptionist = await prisma.user.create({
    data: {
      email: "reception@shefaclinic.example",
      name: "Mitu Akter",
      passwordHash,
      role: "RECEPTIONIST",
      phone: "01711000002",
      lastLoginAt: addDays(TODAY, -1),
    },
  });

  const doctorSpecs = [
    {
      email: "dr.rahman@shefaclinic.example",
      name: "Dr. Farhana Rahman",
      phone: "01711000003",
      profile: {
        specialization: "General Medicine",
        qualifications: "MBBS, FCPS (Medicine)",
        licenseNumber: "BMDC-A-45201",
        consultationFee: 800,
        roomNumber: "201",
        bio: "Fifteen years in primary care, with a special interest in diabetes and hypertension management.",
        availableDays: withToday([1, 2, 3, 4, 6]),
        startTime: "09:00",
        endTime: "17:00",
        slotMinutes: 30,
      },
    },
    {
      email: "dr.hossain@shefaclinic.example",
      name: "Dr. Imran Hossain",
      phone: "01711000004",
      profile: {
        specialization: "Paediatrics",
        qualifications: "MBBS, DCH, FCPS (Paediatrics)",
        licenseNumber: "BMDC-A-51880",
        consultationFee: 900,
        roomNumber: "202",
        bio: "Paediatrician focused on childhood respiratory illness, nutrition and routine immunisation.",
        availableDays: withToday([1, 2, 3, 4, 7]),
        startTime: "10:00",
        endTime: "18:00",
        slotMinutes: 20,
      },
    },
    {
      email: "dr.jahan@shefaclinic.example",
      name: "Dr. Nusrat Jahan",
      phone: "01711000005",
      profile: {
        specialization: "Dermatology",
        qualifications: "MBBS, DDV",
        licenseNumber: "BMDC-A-60417",
        consultationFee: 1200,
        roomNumber: "203",
        bio: "Treats chronic skin conditions, allergic dermatitis and cosmetic dermatology.",
        availableDays: withToday([1, 3, 6]),
        startTime: "14:00",
        endTime: "20:00",
        slotMinutes: 30,
      },
    },
  ];

  const doctors = [];
  for (const spec of doctorSpecs) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        role: "DOCTOR",
        phone: spec.phone,
        lastLoginAt: TODAY,
        doctorProfile: { create: spec.profile },
      },
      include: { doctorProfile: true },
    });
    doctors.push({
      id: user.doctorProfile!.id,
      name: user.name,
      fee: spec.profile.consultationFee,
      specialization: spec.profile.specialization,
      availableDays: spec.profile.availableDays,
      startTime: spec.profile.startTime,
      endTime: spec.profile.endTime,
      slotMinutes: spec.profile.slotMinutes,
    });
  }

  // ---- services -------------------------------------------------------
  console.log("→ Creating the price list…");
  await prisma.service.createMany({ data: SERVICES });
  const services = await prisma.service.findMany();
  const serviceByCode = new Map(services.map((service) => [service.code, service]));

  // ---- patients -------------------------------------------------------
  console.log("→ Registering patients…");
  const year = TODAY.getFullYear();
  const patients = [];
  for (const [index, spec] of PATIENTS.entries()) {
    const patient = await prisma.patient.create({
      data: {
        mrn: `P-${year}-${String(index + 1).padStart(4, "0")}`,
        firstName: spec.firstName,
        lastName: spec.lastName,
        dateOfBirth: dateOfBirth(spec.age, index + 1),
        gender: spec.gender,
        phone: spec.phone,
        email: spec.email,
        address: spec.address,
        city: spec.city,
        bloodGroup: spec.bloodGroup,
        allergies: spec.allergies,
        chronicConditions: spec.chronicConditions,
        emergencyContactName: spec.emergencyContactName,
        emergencyContactPhone: spec.emergencyContactPhone,
        createdById: receptionist.id,
        createdAt: addDays(TODAY, -intBetween(5, 300)),
      },
    });
    patients.push(patient);
  }

  // ---- appointments, consultations, invoices --------------------------
  console.log("→ Building the diary, consultations and invoices…");

  const appointmentSeq = new Map<string, number>();
  let invoiceCounter = 0;

  const nextAppointmentCode = (day: Date) => {
    const key = stamp(day);
    const next = (appointmentSeq.get(key) ?? 0) + 1;
    appointmentSeq.set(key, next);
    return `APT-${key}-${String(next).padStart(4, "0")}`;
  };

  const nextInvoiceNumber = () => {
    invoiceCounter += 1;
    return `INV-${year}-${String(invoiceCounter).padStart(4, "0")}`;
  };

  for (let offset = -24; offset <= 10; offset += 1) {
    const day = addDays(TODAY, offset);
    const weekday = isoWeekday(day);
    const isPast = offset < 0;
    const isToday = offset === 0;

    for (const doctor of doctors) {
      if (!doctor.availableDays.includes(weekday)) continue;

      const open = timeToMinutes(doctor.startTime);
      const close = timeToMinutes(doctor.endTime);
      const totalSlots = Math.floor((close - open) / doctor.slotMinutes);

      // A believable load: busier in the recent past, lighter further out.
      const load = isToday
        ? intBetween(5, 7)
        : isPast
          ? intBetween(2, 5)
          : intBetween(1, 3);

      const slotIndexes = pickSome(
        Array.from({ length: totalSlots }, (_, index) => index),
        Math.min(load, totalSlots),
      ).sort((a, b) => a - b);

      for (const [position, slotIndex] of slotIndexes.entries()) {
        const scheduledAt = at(day, open + slotIndex * doctor.slotMinutes);
        const patient = pick(patients);
        const complaint = pick(COMPLAINTS);

        const type: AppointmentType = chance(0.18)
          ? "FOLLOW_UP"
          : chance(0.07)
            ? "EMERGENCY"
            : "NEW_VISIT";

        // ---- decide the status --------------------------------------
        let status: AppointmentStatus;
        if (isPast) {
          status = chance(0.84)
            ? "COMPLETED"
            : chance(0.6)
              ? "CANCELLED"
              : "NO_SHOW";
        } else if (isToday) {
          // Shape today's queue so the dashboard shows a live clinic:
          // early slots done, one in consultation, one waiting, rest ahead.
          if (position === 0) status = "COMPLETED";
          else if (position === 1) status = "COMPLETED";
          else if (position === 2) status = "IN_CONSULTATION";
          else if (position === 3) status = "CHECKED_IN";
          else status = "SCHEDULED";
        } else {
          status = "SCHEDULED";
        }

        const checkedInAt =
          status === "CHECKED_IN" ||
          status === "IN_CONSULTATION" ||
          status === "COMPLETED"
            ? new Date(scheduledAt.getTime() - intBetween(2, 14) * 60_000)
            : null;
        const startedAt =
          status === "IN_CONSULTATION" || status === "COMPLETED"
            ? new Date(scheduledAt.getTime() + intBetween(0, 8) * 60_000)
            : null;
        const completedAt =
          status === "COMPLETED"
            ? new Date(scheduledAt.getTime() + intBetween(12, 28) * 60_000)
            : null;

        const appointment = await prisma.appointment.create({
          data: {
            code: nextAppointmentCode(day),
            patientId: patient.id,
            doctorId: doctor.id,
            scheduledAt,
            durationMinutes: doctor.slotMinutes,
            status,
            type,
            reason: complaint.reason,
            notes: chance(0.25) ? "Patient requested an early slot." : null,
            checkedInAt,
            startedAt,
            completedAt,
            cancelledAt:
              status === "CANCELLED"
                ? new Date(scheduledAt.getTime() - 3 * 60 * 60_000)
                : null,
            cancellationReason:
              status === "CANCELLED"
                ? pick([
                    "Patient called to postpone.",
                    "Doctor unavailable — emergency call.",
                    "Rebooked for a later date.",
                  ])
                : null,
            createdById: receptionist.id,
            createdAt: addDays(scheduledAt, -intBetween(1, 6)),
          },
        });

        if (status !== "COMPLETED") continue;

        // ---- consultation -------------------------------------------
        const recordedAt = completedAt ?? scheduledAt;
        const consultation = await prisma.consultation.create({
          data: {
            appointmentId: appointment.id,
            patientId: patient.id,
            doctorId: doctor.id,
            temperatureC: round2(36.4 + random() * 2.1),
            pulseBpm: intBetween(62, 98),
            systolicBp: intBetween(106, 152),
            diastolicBp: intBetween(66, 94),
            respiratoryBpm: intBetween(12, 22),
            spo2: intBetween(94, 100),
            weightKg: round2(14 + random() * 70),
            heightCm: round2(95 + random() * 85),
            symptoms: complaint.symptoms,
            examination: complaint.examination,
            diagnosis: complaint.diagnosis,
            treatmentPlan: complaint.treatmentPlan,
            advice: complaint.advice,
            followUpDate: chance(0.4)
              ? addDays(day, intBetween(5, 28))
              : null,
            createdAt: recordedAt,
            updatedAt: recordedAt,
            prescriptions: {
              create: complaint.medicines.map((medicine) => ({
                ...medicine,
                createdAt: recordedAt,
              })),
            },
          },
        });

        // ---- invoice -------------------------------------------------
        // A few finished visits stay unbilled on purpose, so the dashboard's
        // "ready to bill" queue has something in it.
        if (!chance(0.88)) continue;

        const consultationServiceCode =
          type === "FOLLOW_UP"
            ? "CONS-FUP"
            : doctor.specialization === "Dermatology"
              ? "CONS-SPEC"
              : "CONS-GEN";

        const items: {
          serviceId: string | null;
          description: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }[] = [];

        const consultationService = serviceByCode.get(consultationServiceCode);
        if (consultationService) {
          const price = Number(consultationService.price);
          items.push({
            serviceId: consultationService.id,
            description: `${consultationService.name} — ${doctor.name}`,
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
          });
        }

        for (const labCode of complaint.labs) {
          const service = serviceByCode.get(labCode);
          if (!service) continue;
          const price = Number(service.price);
          items.push({
            serviceId: service.id,
            description: service.name,
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
          });
        }

        if (complaint.medicines.length > 0 && chance(0.5)) {
          const dispensing = serviceByCode.get("MED-DISP");
          if (dispensing) {
            const price = Number(dispensing.price);
            const quantity = complaint.medicines.length;
            items.push({
              serviceId: dispensing.id,
              description: dispensing.name,
              quantity,
              unitPrice: price,
              lineTotal: round2(price * quantity),
            });
          }
        }

        if (items.length === 0) continue;

        const subtotal = round2(
          items.reduce((sum, item) => sum + item.lineTotal, 0),
        );
        const discountAmount = chance(0.18)
          ? round2(Math.min(subtotal * 0.1, 200))
          : 0;
        const totalAmount = round2(subtotal - discountAmount);

        // Payment behaviour: most settled, some partial, a few still unpaid.
        const roll = random();
        const paidAmount =
          roll < 0.72
            ? totalAmount
            : roll < 0.9
              ? round2(totalAmount * (0.3 + random() * 0.4))
              : 0;

        const invoiceStatus =
          paidAmount >= totalAmount
            ? "PAID"
            : paidAmount > 0
              ? "PARTIALLY_PAID"
              : "UNPAID";

        const issuedAt = new Date(recordedAt.getTime() + 11 * 60_000);

        const invoice = await prisma.invoice.create({
          data: {
            number: nextInvoiceNumber(),
            patientId: patient.id,
            consultationId: consultation.id,
            issuedAt,
            subtotal,
            discountAmount,
            taxAmount: 0,
            totalAmount,
            paidAmount,
            status: invoiceStatus,
            notes: discountAmount > 0 ? "Returning-patient discount applied." : null,
            createdById: receptionist.id,
            createdAt: issuedAt,
            items: { create: items },
          },
        });

        if (paidAmount > 0) {
          const method: PaymentMethod = pick([
            "CASH",
            "CASH",
            "MOBILE_BANKING",
            "CARD",
            "BANK_TRANSFER",
          ]);
          await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: paidAmount,
              method,
              reference:
                method === "MOBILE_BANKING"
                  ? `BK${intBetween(100000, 999999)}`
                  : method === "CARD"
                    ? `TRX${intBetween(10000, 99999)}`
                    : null,
              paidAt: new Date(issuedAt.getTime() + intBetween(2, 25) * 60_000),
              receivedById: receptionist.id,
            },
          });
        }
      }
    }
  }

  // ---- summary --------------------------------------------------------
  const [
    patientCount,
    appointmentCount,
    consultationCount,
    invoiceCount,
    paymentAggregate,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.consultation.count(),
    prisma.invoice.count(),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
  ]);

  console.log("\n✓ Seed complete\n");
  console.table({
    "Staff accounts": 2 + doctors.length,
    Services: services.length,
    Patients: patientCount,
    Appointments: appointmentCount,
    Consultations: consultationCount,
    Invoices: invoiceCount,
    Payments: paymentAggregate._count._all,
    Collected: Number(paymentAggregate._sum.amount ?? 0).toFixed(2),
  });

  console.log("\nDemo accounts (password for all: " + SEED_PASSWORD + ")");
  console.table([
    { Role: "Administrator", Email: admin.email },
    { Role: "Receptionist", Email: receptionist.email },
    { Role: "Doctor", Email: "dr.rahman@shefaclinic.example" },
    { Role: "Doctor", Email: "dr.hossain@shefaclinic.example" },
    { Role: "Doctor", Email: "dr.jahan@shefaclinic.example" },
  ]);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
