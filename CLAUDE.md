# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IPPL is a full-stack healthcare management platform for a psychology practice. It manages patients, professionals (therapists), appointments, payments, and clinical records. Users have distinct roles with separate dashboards and access levels.

## Commands

### Frontend (root)
```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build to /dist
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest watch mode
npm run test:coverage
```

### Backend (`cd backend`)
```bash
npm run dev          # Nodemon on http://localhost:5000
npm start            # Production

# Database
npm run db:reset     # Drop + recreate + migrate + seed (full reset)
npm run db:migrate   # Run pending migrations only
npm run db:seed:all  # Run all seeders

# Data maintenance scripts
npm run db:backfill-recurring:apply
npm run db:deactivate-recurring-inactive:apply
npm run db:purge-appointments-before-week
```

### Running a single frontend test
```bash
npx vitest run src/components/__tests__/MyComponent.test.tsx
```

## Architecture

### Full-Stack Structure
- **Frontend:** React 18 + TypeScript, served from `/src`. Vite proxies `/api` → `localhost:5000` in development. Production: backend serves `/dist` as static files.
- **Backend:** Express + Sequelize ORM + MySQL 8, all under `backend/`.

### Backend Layers
```
Routes → Controllers → Services → Models (Sequelize)
                     ↓
              Validators (Joi) applied via middleware
              Mappers/DTOs transform model instances for API responses
```
- **`backend/src/controllers/`** — request/response orchestration, call services
- **`backend/src/services/`** — business logic (financial effects, recurring generation, reconciliation)
- **`backend/models/`** — Sequelize model definitions and associations
- **`backend/src/middleware/`** — JWT auth, Joi validation, rate limiting, error/request logging
- **`backend/mappers/`** + **`backend/dtos/`** — transform DB rows into API response shapes
- **`backend/src/jobs/`** — cron job for recurring appointment generation (`recurringAppointmentsCron.js`)
- **`backend/src/validators/`** — Joi schemas per entity, applied via `validate.js` middleware

### Frontend Layers
- **`src/services/`** — one Axios-based service file per entity (e.g., `appointments.service.ts`). `api.ts` is the shared Axios instance with JWT interceptors.
- **`src/pages/`** — route-level components split by role (`admin/`, `professional/`)
- **`src/components/`** — reusable UI split by role/feature
- **`src/context/`** — Auth context (login state, user role)
- State management: Zustand for global state, TanStack Query for server state

### Role System
Four roles with separate route trees:
- **admin** → `/admin/*` — full system access
- **professional** → `/professional/*` — own patients, appointments, schedule
- **content** → content management only
- **financial** → payment/reporting dashboards only

### Key Domain Concepts
- **RecurringAppointment** — template that drives cron-based generation of individual `Appointment` rows
- **Appointment** — tracks `sessionCost`, `paymentAmount`, `remainingBalance` per session
- **Abono** — pre-payment/credit applied to a patient's balance
- **StatusRequest / VacationRequest / FrequencyRequest** — workflow requests that require admin approval
- Financial reconciliation recalculates professional `saldoTotal` / `saldoPendiente` from raw appointment data

### Patient Creation & Assignment Flow
Creating a patient from the admin UI (`handleAddPatient` in `src/components/admin/PatientManagement.tsx`) is **multi-step**, not a single API call:
1. `POST /patients` (`addPatient`) — creates the base row. Accepts `name`, `description`, `status`, `sessionFrequency` (no professional).
2. `PUT /patients/:id/assign` (`assignPatient`) — assigns professional + re-confirms `status`/`sessionFrequency`. Only called when a professional was selected.
3. First `Appointment` is created, then a `RecurringAppointment` (or `createPatientRecurringScheduleAdmin` for `twice_weekly`).

Each step is wrapped in its own try/catch so a later failure doesn't roll back an already-created patient — **surface failures to the user (toast)**, don't swallow them silently.

The `/patients/:id/assign` endpoint is **dual-purpose**: it handles both first assignment and reassignment. Reassignment (`willReassign`) means moving a patient that **already had a professional** (`originalProfessionalId != null`) to a different one — only then is `nextDate` required and the recurring agenda re-anchored via `reassignProfessionalService.js`. A first assignment must NOT be treated as a reassignment.

## Environment Setup

Backend requires a `.env` file in `backend/`:
```
JWT_SECRET=<32+ char random string>
DB_USER=root
DB_PASS=root1234
DB_NAME=ippl_db
DB_HOST=127.0.0.1
DB_PORT=3306
PORT=5000
NODE_ENV=development
```

## Key Conventions

- **Language:** UI text and error messages are in Spanish; code identifiers and comments are in English.
- **DB transactions:** Any operation that modifies multiple tables must use a Sequelize transaction — see `appointmentsController.js` and `userController.js` for examples.
- **Response format:** All API responses use `backend/src/utils/response.js` helpers (`successResponse`, `errorResponse`).
- **Logging:** Use Winston logger from `backend/src/utils/logger.js`, not `console.log`.
- **Validation:** Add Joi schemas in `backend/src/validators/` and apply via the `validate` middleware in the route file, not inside controllers.
- **Date/time:** Use `civilDateUtils.js` and `timeRangeUtils.js` for date normalization — avoid ad-hoc date arithmetic, as recurring appointment logic is sensitive to timezone and format inconsistencies.
