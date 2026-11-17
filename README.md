# Expense Tracker

A personal expense tracker built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma**, **SQLite**, **Auth.js (NextAuth)**, and **local receipt uploads**.

You can:

- Sign up / log in (per-user expenses and budgets)
- Add, edit, and delete expenses (amounts stored as integer minor units / cents)
- Attach receipt images/PDFs (stored under a private `uploads/` folder)
- Filter expenses by month and category
- Set per-category monthly budgets and see progress
- View spending reports (by category, last 6 months, top expenses) and download CSV

## Prerequisites

- Node.js 20+ recommended
- npm

No external database or cloud storage is required for local use.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

See `.env.example` for every variable (`DATABASE_URL` and Auth.js). Generate an auth secret:

```bash
npx auth secret
```

3. Generate the Prisma client, run migrations, and seed data:

```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

Seed creates:

- Shared categories: Food, Transport, Bills, Shopping, Health, Other
- Demo user: `demo@example.com` / `password123` (skip with `SEED_DEMO_USER=false`)

Receipt files are written to `uploads/` at the project root (gitignored) the first time you upload one.

## Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are redirected to `/login`.

Useful routes:

- `/login`, `/signup` — authentication
- `/` — expenses
- `/budgets` — monthly budgets
- `/reports` — charts and CSV export

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Run the production server |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:seed` | Seed categories (+ optional demo user) |
| `npm run db:studio` | Open Prisma Studio |

## Money handling

All money is stored as **integers in the smallest unit** (`amountMinor`, `monthlyLimitMinor`). Decimal amounts from forms are converted with `toMinorUnits` on the server before saving. Display formatting happens in the UI via `formatMoney` / `formatMinorUnits`.
