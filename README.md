# Clinic Management Lite

A small-clinic management system built around **one real business process**:

> **Register a patient → book an appointment → check in → record the consultation → raise the invoice → take payment → the visit history and the dashboard update.**

Nothing on the dashboard is hard-coded. Every number is aggregated from stored
records at page load.

---

## Contents

- [The problem](#the-problem)
- [Who uses it](#who-uses-it)
- [The core workflow](#the-core-workflow)
- [Features](#features)
- [Business rules enforced](#business-rules-enforced)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [Demo credentials](#demo-credentials)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Known limitations](#known-limitations)
- [Reflection](#reflection)

---

## The problem

A small clinic runs on paper: an appointment book at the desk, a prescription
pad in the consulting room, and a receipt book at the till. Those three records
never agree with each other. Nobody can answer "how much did we collect today?"
or "when did this patient last come in, and what were they given?" without
turning pages.

Clinic Management Lite joins them into one record. A visit carries its own
consultation, its own prescription and its own invoice, so the patient history
and the day's figures are the same truth, derived from the same rows.

## Who uses it

| Role | What they do |
|---|---|
| **Receptionist** | Registers patients, books and reschedules visits, checks patients in, raises invoices, records payments |
| **Doctor** | Sees their own queue, records consultations and prescriptions, sets follow-up dates |
| **Administrator** | Everything above, plus staff accounts, roles and the clinic price list |

Role-based access is enforced in three places: the Edge middleware, the page
guard, and again inside every server action — so a restricted action fails even
if someone posts to it directly.

## The core workflow

```
┌──────────────┐   ┌───────────────┐   ┌─────────────┐   ┌──────────────┐   ┌───────────┐
│ 1. Register  │──▶│ 2. Book visit │──▶│ 3. Check in │──▶│ 4. Consult   │──▶│ 5. Bill   │
│   patient    │   │  (slot check) │   │ (front desk)│   │  (doctor)    │   │ & collect │
└──────────────┘   └───────────────┘   └─────────────┘   └──────────────┘   └───────────┘
       │                   │                  │                 │                 │
       ▼                   ▼                  ▼                 ▼                 ▼
    MRN issued      Diary conflict      Status moves      Diagnosis +        Invoice,
   P-2026-0019       checked live       SCHEDULED →       prescription       payment,
                                        CHECKED_IN        saved; visit       receipt;
                                                          COMPLETED          dues update
```

Each arrow is a real state transition stored in the database, and the dashboard
re-aggregates after every one of them.

### Appointment state machine

```
SCHEDULED ──▶ CHECKED_IN ──▶ IN_CONSULTATION ──▶ COMPLETED
    │              │
    └──────────────┴──▶ CANCELLED | NO_SHOW
```

The allowed transitions live in one constant
([`src/lib/constants.ts`](src/lib/constants.ts)) that both the service layer and
the UI read, so the buttons on screen can never offer an illegal move, and the
server rejects one anyway if it is forged.

## Features

**Patients**
- Registry with a single search box matching name, MRN, phone or email, plus gender and archived filters
- Auto-issued medical record number (`P-2026-0019`)
- Full profile: demographics, allergies, chronic conditions, emergency contact
- Complete visit history — every consultation, prescription, appointment and invoice on one page
- Lifetime billed / paid / outstanding totals computed from invoices

**Appointments**
- Live slot picker: the booking form asks the server which slots are still free for that doctor, day and visit length
- Filters by status, doctor, date and free text; paginated
- Check in, start consultation, complete, cancel (with a reason) and no-show
- Reschedule with the same conflict checks
- Per-visit progress timeline

**Consultations**
- Vitals with per-field clinical range checks, auto-computed BMI
- Symptoms, examination, diagnosis, treatment plan, advice
- Repeatable prescription rows saved atomically with the record
- Previous visits shown beside the form while the doctor types
- Follow-up date that feeds the dashboard's follow-up queue
- Print-friendly prescription sheet with the clinic letterhead and signature block

**Billing**
- Invoice built from the attending doctor's fee plus anything from the price list
- Prices are re-read from the catalogue on the server, so a tampered form cannot change what a service costs
- Discount and tax, with live totals
- Payments with method, reference and running balance
- Printable A4 receipt that opens its own print dialog
- Admin-maintained service catalogue

**Dashboard**
- Appointments today, consultations today, collected today, outstanding dues — all aggregated live
- 14-day payments trend (area chart with crosshair tooltip)
- 14-day visits per day, split by outcome (stacked bars)
- Today's queue status as a part-to-whole bar
- Today's schedule with the workflow action buttons inline
- "Ready to bill" queue, follow-ups due, busiest doctors this month
- Doctors see their own clinic; reception and admin see the whole day

**Throughout**
- Loading skeletons, empty states and error boundaries on every list
- Light / dark / system theme, resolved before first paint
- Real tables on desktop, stacked cards on mobile — not a sideways-scrolling grid
- Keyboard-navigable combobox, focus-visible rings, ARIA live regions for toasts
- Charts ship a screen-reader data table alongside the visual

## Business rules enforced

These are checked in the service layer, inside a transaction where it matters —
not only in the browser.

| Rule | Where |
|---|---|
| A doctor cannot be double-booked — overlapping visits are rejected, naming the clashing booking | `appointment.service.ts` |
| A patient cannot have two visits at the same time | `appointment.service.ts` |
| Bookings must fall inside the doctor's working days and hours, and the whole visit must finish before closing | `appointment.service.ts` |
| Appointments cannot be booked in the past, or more than 180 days ahead | `validations/appointment.ts` |
| Only legal status transitions are accepted | `appointment.service.ts` |
| A visit more than 24 hours old cannot be checked in | `appointment.service.ts` |
| Cancelling requires a reason | `appointment.service.ts` |
| Only the attending doctor (or an admin) can record a consultation | `consultation.service.ts` |
| A consultation can only be recorded for a checked-in patient | `consultation.service.ts` |
| Consultation, prescriptions and the appointment status change in one transaction | `consultation.service.ts` |
| A consultation can be billed exactly once | `billing.service.ts` + DB unique constraint |
| Only a completed consultation can be billed | `billing.service.ts` |
| **A payment can never exceed the outstanding balance** | `billing.service.ts` |
| A cancelled invoice cannot take payments | `billing.service.ts` |
| An invoice with payments against it cannot be cancelled | `billing.service.ts` |
| A discount cannot exceed the subtotal | `validations/billing.ts` + `billing.service.ts` |
| A retired service cannot be added to a new invoice | `billing.service.ts` |
| A patient with open appointments cannot be archived | `patient.service.ts` |
| Phone numbers are unique — duplicate registration is blocked and names the existing record | `patient.service.ts` |
| The clinic must keep at least one active administrator | `staff.service.ts` |
| An admin cannot deactivate their own account or drop their own role | `staff.service.ts` |
| A doctor with open appointments cannot have their role changed | `staff.service.ts` |

Vitals, dates, phone numbers, passwords and money are all range-checked by Zod
schemas shared between the forms and the server.

### Proving they work

`npm run verify` runs [`scripts/verify-workflow.ts`](scripts/verify-workflow.ts)
against the live database through the real service layer. It registers a
patient, books a visit, checks in, records a consultation, raises the invoice
and takes payment — and at each step also attempts the **illegal** version of
that step and asserts it is refused. It prints the actual refusal message for
every rule, then deletes everything it created so the demo data is untouched.

```
33 passed, 0 failed
```

Sample output:

```
2 · Book the visit
  ✓ slot availability is computed from the diary        2026-11-09 10:00
  ✓ the same doctor cannot be double-booked in that slot
      blocked: "That slot overlaps APT-20261109-0008 (…) from 10:00 AM to 10:30 AM."
  ✓ a partially overlapping visit is also rejected
  ✓ the same patient cannot be booked with two doctors at once

6 · Take payment
  ✓ a payment larger than the balance is refused
      blocked: "That payment is ৳ 500.00 more than the outstanding balance of ৳ 1,200.00."
  ✓ an invoice with payments against it cannot be cancelled
  ✓ paying the balance settles the invoice              status PAID
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, React 19, TypeScript) | Server Components keep data access on the server; Server Actions remove the need for a separate API layer |
| Database | **PostgreSQL** | Relational data with real foreign keys — a visit genuinely belongs to a patient |
| ORM | **Prisma 6** | Typed queries, migrations, transactions |
| Styling | **Tailwind CSS v4** | CSS-first tokens; one `data-theme` attribute drives light and dark |
| Validation | **Zod** | One schema validates the form and the server action |
| Auth | **jose** (JWT) + **bcryptjs** | httpOnly cookie session; verification runs on the Edge, so middleware needs no database |
| Icons | **lucide-react** | |
| Charts | Hand-written inline SVG | No chart dependency; palette validated for colour-vision deficiency in both themes |

Money is stored as `NUMERIC(12,2)`, never as a float. Prisma `Decimal` values
are converted to plain numbers at the service boundary
([`src/lib/serialize.ts`](src/lib/serialize.ts)) so they can cross into client
components safely.

## Data model

Ten tables. The core chain is `Patient → Appointment → Consultation → Invoice → Payment`.

```
User ─┬─ Doctor ──┬─ Appointment ── Consultation ─┬─ Prescription
      │           │       │                       │
      │           └───────┘                       └─ Invoice ─┬─ InvoiceItem ── Service
      │                   │                                   │
      └───────────────────┴─ Patient ───────────────────────── └─ Payment
```

| Table | Purpose |
|---|---|
| `users` | Staff logins and roles |
| `doctors` | Clinical profile, fee and weekly availability |
| `patients` | Registry, MRN, demographics, clinical flags |
| `appointments` | The diary, with the status lifecycle |
| `consultations` | One clinical record per visit (1:1 with appointment) |
| `prescriptions` | Medicines within a consultation |
| `services` | Price list of billable items |
| `invoices` | Bill raised against a consultation |
| `invoice_items` | Line items, priced from the catalogue |
| `payments` | Money received against an invoice |

Full schema: [`prisma/schema.prisma`](prisma/schema.prisma).

## Project structure

```
prisma/
  schema.prisma          data model
  seed.ts                realistic demo data (deterministic)
src/
  app/
    (app)/               authenticated shell: dashboard, patients, appointments,
                         consultations, invoices, doctors, services, staff
    invoices/[id]/print  printable receipt, rendered outside the shell
    login/               sign-in
    api/health/          liveness probe
  actions/               server actions — the only write path from the UI
  components/
    ui/                  design system: button, field, card, table, badge,
                         modal, toast, filters, pagination, charts, states
    layout/              app shell, sidebar, page header
    patients/ appointments/ consultations/ billing/ staff/
  lib/
    auth/                jwt (edge-safe), session, password
    services/            business logic — the only place that touches Prisma
    validations/         Zod schemas shared by forms and actions
    db.ts errors.ts serialize.ts utils.ts constants.ts nav.ts
  middleware.ts          Edge auth guard
```

The rule the codebase follows: **pages read through services, write through
actions, and actions call services.** No page or component talks to Prisma
directly.

## Running it locally

### Prerequisites

- Node.js 20 or newer (built on 24)
- A PostgreSQL database — a free [Neon](https://neon.tech) or
  [Supabase](https://supabase.com) project works, as does local Postgres

### Steps

```bash
# 1. install
npm install

# 2. environment
cp .env.example .env
```

Fill in `.env`:

```ini
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="<a long random string>"
SEED_PASSWORD="Passw0rd!"
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> `DATABASE_URL` is the pooled connection used at runtime; `DIRECT_URL` is the
> direct one Prisma migrations need. On Neon that is the same host without the
> `-pooler` suffix. With local Postgres, set both to the same value.

```bash
# 3. create the tables
npm run db:migrate

# 4. load demo data
npm run db:seed

# 5. run
npm run dev
```

Open <http://localhost:3000>.

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run verify` | Walks the whole workflow against the live database and asserts every business rule (see below) |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Reset demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate and re-seed |

## Demo credentials

Password for every account: **`Passw0rd!`**

| Role | Email | What to try |
|---|---|---|
| Administrator | `admin@shefaclinic.example` | Everything, plus staff accounts and the price list |
| Receptionist | `reception@shefaclinic.example` | Register, book, check in, invoice, take payment |
| Doctor | `dr.rahman@shefaclinic.example` | Own queue, consultations, prescriptions |
| Doctor | `dr.hossain@shefaclinic.example` | Paediatrics clinic |
| Doctor | `dr.jahan@shefaclinic.example` | Dermatology clinic |

The login screen has a one-click fill button for each account.

### Walking the full workflow in two minutes

1. Sign in as the **receptionist**.
2. **Patients → Register patient** — fill the form, save. An MRN is issued.
3. On the new profile, **Book visit** — choose `Dr. Farhana Rahman`, today's
   date. Taken slots are struck through; pick a free one and book.
   *(Try picking a slot that is already taken to see the conflict rule fire.)*
4. **Check in** the patient from the dashboard queue.
5. Sign out, sign in as **`dr.rahman@shefaclinic.example`**.
6. The visit is in the queue — **Start consultation**. Record vitals, symptoms
   and a diagnosis, add a medicine, set a follow-up date, **Save & complete**.
7. Sign back in as the **receptionist**. The dashboard shows the visit under
   **Ready to bill** — click **Bill**.
8. The consultation fee is pre-filled. Add a lab test from the price list,
   apply a discount, create the invoice.
9. **Record a payment.** *(Try an amount larger than the balance — the server
   refuses it and says by how much.)*
10. **Print receipt**, then open the patient's profile: the visit, the
    prescription and the invoice are all on their history, and the dashboard
    totals have moved.

## Deployment

The app deploys as a single Next.js service. Vercel is the shortest path.

1. Push the repository to GitHub.
2. Create a Postgres database (Neon, Supabase, Railway, or Vercel Postgres).
3. Import the repository on Vercel and set the environment variables:
   - `DATABASE_URL` — pooled connection string
   - `DIRECT_URL` — direct connection string
   - `AUTH_SECRET` — a fresh long random string (**not** the local one)
   - `SEED_PASSWORD` — only if you intend to seed the production database
4. Deploy. The build script runs `prisma generate` automatically.
5. Apply migrations and demo data against the production database once:

```bash
DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npx prisma migrate deploy
DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npm run db:seed
```

`GET /api/health` returns `200` with database latency, or `503` if the database
is unreachable — useful as an uptime check.

**Secrets:** `.env` is git-ignored. Only `.env.example`, which contains
placeholders, is committed.

## Screenshots

Add 3–5 images to `docs/screenshots/` and they will render here.

| | |
|---|---|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Booking](docs/screenshots/02-booking.png) |
| *Dashboard — every figure aggregated from stored rows* | *Booking — live slot availability* |
| ![Consultation](docs/screenshots/03-consultation.png) | ![Invoice](docs/screenshots/04-invoice.png) |
| *Consultation — vitals, diagnosis, prescription* | *Invoice — payment with balance enforcement* |
| ![Patient history](docs/screenshots/05-patient-history.png) | |
| *Patient history — the whole chain in one place* | |

## Known limitations

Deliberately out of scope for a four-day build:

- **No pharmacy stock.** Medicines are prescribed and a dispensing fee can be
  billed, but inventory is not tracked.
- **No refunds.** An invoice with payments cannot be cancelled; it would need a
  credit note.
- **Single clinic, single timezone.** Working hours are stored as `"HH:mm"` and
  interpreted in the server's timezone. A multi-branch clinic would need a
  timezone per location.
- **No appointment reminders.** No SMS or email is sent.
- **Document numbers are generated by read-then-increment** inside a
  transaction, with a retry on collision. Correct at clinic scale; a dedicated
  sequence would be better at high concurrency.
- **No audit log.** Rows record who created them, but there is no history of
  every edit.
- **No file uploads.** Lab reports and scans cannot be attached.
- **No unit test suite or CI.** There is one integration script
  (`npm run verify`, 33 assertions) that exercises the whole workflow and every
  business rule against a real database, but no per-function unit tests and
  nothing wired into a pipeline.
- **The seed bends one rule for the demo's sake.** Each doctor has a designed
  weekly pattern, but the seed folds today's weekday into every doctor's
  availability so the queue is never empty whichever day a reviewer opens it.
  Remove `withToday()` in `prisma/seed.ts` for strictly realistic rotas.

## Reflection

**What I built.** A clinic system where one real process runs end to end:
register, book, check in, consult, bill, collect — and every figure on the
dashboard is recomputed from those rows rather than stored or faked.

**The challenge.** Appointment conflicts were harder than they looked. The
naive check — "is anything booked at this exact time?" — misses the real case,
where a 45-minute visit at 10:00 collides with a 30-minute one at 10:30. Getting
it right meant treating every booking as an interval and testing for genuine
overlap, which needs both sides of the range: candidates that *start* before the
new visit ends, filtered to those that *end* after it begins. The same rule then
had to be applied three times — when booking, when rescheduling (excluding the
visit being moved), and when listing free slots — so it lives in one place and
all three paths call it.

**What I would improve next.** Turn `npm run verify` into a proper test suite.
Writing it already paid for itself: two of its assertions passed for the wrong
reason on the first run — the patient-clash check was actually being stopped by
the working-hours rule, because the slot I picked happened to be outside the
second doctor's shift. A green tick that proves nothing is worse than no tick,
so the script now hunts for a slot free in *both* doctors' diaries before
asserting. The next step is splitting those 33 assertions into isolated cases
against a throwaway database, so they can run on every commit instead of by
hand.

---

Built for the Puja Holiday Real-Life Project Sprint, 20–23 October.
