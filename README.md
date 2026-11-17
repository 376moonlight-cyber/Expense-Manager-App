# Expense Tracker

A personal expense tracker built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma**, **SQLite**, **Auth.js (NextAuth)**, and **local receipt uploads**.

You can:

- Sign up / log in (per-user expenses and budgets)
- Add, edit, and delete expenses (amounts stored as integer minor units / cents)
- Attach receipt images/PDFs (stored under a private `uploads/` folder)
- Filter expenses by month and category
- Set per-category monthly budgets and see progress
- View spending reports (by category, last 6 months, top expenses) and download CSV
- Download a full ZIP backup and restore it (merge or replace) from Settings

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

- Demo user: `demo@example.com` / `password123` (skip with `SEED_DEMO_USER=false`)
- Per-user starter categories: Food, Transport, Bills, Shopping, Health, Other

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

## Backup & restore

Settings includes a full-account ZIP backup (separate from CSV export/import).

### Download backup

Use **Settings → Backup → Download backup**. The server builds:

```
expense-tracker-backup-YYYY-MM-DD.zip
├── data.json          # format version, createdAt, settings, categories,
│                      # expenses, incomes, budgets, recurring items
└── receipts/          # JPEG, PNG, or PDF files referenced by expenses
```

Only the logged-in user’s data is included. The app records `lastBackupAt` and shows a gentle reminder if there has been no backup for 30 days.

### Restore backup

Use **Settings → Restore** and upload a ZIP (max **50 MB**). The server validates format version, structure, field types, and that every referenced receipt exists (JPEG/PNG/PDF only; path traversal is rejected). Invalid files are rejected with a clear message and nothing is changed.

After a successful preview you can:

- **Merge** — keep current data; add missing categories (by name), budgets, expenses, income, and recurring items
- **Replace** — delete current categories/expenses/income/budgets/recurring/receipts and load the backup (requires typing `RESTORE`)

Restore runs in a database transaction. Restored rows always use the logged-in user’s id; ids from the file are remapped and never trusted as `userId`.
