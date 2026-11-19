# Expense Manager App

A personal finance app built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma**, **PostgreSQL (Neon)**, **Auth.js (NextAuth)**, and **private Vercel Blob** receipt storage.

You can:

- Sign up / log in (per-user data)
- Track **expenses** (amounts as integer minor units / cents; optional receipt images or PDFs in private Vercel Blob storage)
- Track **income**
- Set per-category monthly **budgets** and see progress
- View **reports** (savings rate, by category, trends, top expenses)
- Manage **recurring** expenses and income
- Organize money across **wallets** (including transfers)
- Save toward **goals**
- Use **settings** for profile, password, categories, currency, CSV import/export, and ZIP backup/restore
- Configure **currency settings** (base currency + manual exchange rates)
- Download a full ZIP **backup** and **restore** it (merge or replace) from Settings
- Learn about the app on the **About** page

## Prerequisites

- Node.js 20+ recommended
- npm
- A [Neon](https://neon.tech) PostgreSQL database (pooled + direct connection strings)
- A private [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store (and `BLOB_READ_WRITE_TOKEN` for local use)

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

See `.env.example` for every variable. Fill in:

- `DATABASE_URL` — Neon **pooled** URL (hostname often includes `-pooler`)
- `DIRECT_URL` — Neon **direct** URL (used by Prisma Migrate)
- `AUTH_SECRET` — generate with `npx auth secret`
- `AUTH_TRUST_HOST=true`
- `BLOB_READ_WRITE_TOKEN` — from your private Vercel Blob store
- Optional: `AUTH_URL`, About page contact vars

3. Generate the Prisma client, run migrations, and (optionally) seed data:

```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

Seed creates:

- Optional demo user: `demo@example.com` (skipped when `SEED_DEMO_USER=false`, and **never** in production / on Vercel production)
- Per-user starter categories: Food, Transport, Bills, Shopping, Health, Other

Receipt files are stored in **private Vercel Blob** (not on the serverless filesystem).

## Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are redirected to `/login`.

Useful routes:

- `/login`, `/signup` — authentication
- `/` — expenses (home)
- `/income` — income
- `/budgets` — monthly budgets
- `/reports` — charts and spending insights
- `/recurring` — recurring expenses and income
- `/wallets` — wallets and transfers
- `/goals` — savings goals
- `/settings` — profile, password, currency, categories, backup/restore, CSV import/export
- `/about` — app info (public; also available when signed in)

## Deploy on Vercel (Hobby)

1. Create a Neon database and copy the **pooled** and **direct** connection strings.
2. In Vercel → Storage, create a **private** Blob store and connect it to the project (include a read-write token env var for local/dev).
3. Add the environment variables listed in [Environment variables for Vercel](#environment-variables-for-vercel).
4. Deploy. The `npm run build` script runs `prisma generate`, `prisma migrate deploy`, then `next build`. It does **not** run `prisma db seed`, so no demo user is created in production.

### Environment variables for Vercel

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres URL used by Prisma Client at runtime |
| `DIRECT_URL` | Neon direct (non-pooled) URL used by `prisma migrate deploy` during build |
| `AUTH_SECRET` | Secret used by Auth.js to sign/encrypt session JWTs |
| `AUTH_TRUST_HOST` | Set to `true` so Auth.js trusts the Vercel host header |
| `AUTH_URL` | Canonical `https://` URL of your deployment (custom domain or `*.vercel.app`) |
| `BLOB_READ_WRITE_TOKEN` | Token for private Vercel Blob read/write (needed locally; also fine on Vercel) |

Optional: `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DEVELOPER_NAME`. Do **not** set `SEED_DEMO_USER=true` in production.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | `prisma generate` + `prisma migrate deploy` + production build |
| `npm run start` | Run the production server |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run postinstall` | Generate Prisma client after install |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:seed` | Seed categories (+ optional demo user; never in production) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run icons` | Regenerate PNG app icons from the logo mark |

## Money & currency

All money is stored as **integers in the smallest unit** (`amountMinor`, `monthlyLimitMinor`, and similar fields). Decimal amounts from forms are converted with `toMinorUnits` on the server before saving. Display formatting happens in the UI via `formatMoney` / `formatMinorUnits`.

In **Settings → Currency settings**, choose a base currency (default **PKR**) and enter manual exchange rates (for example, `1 USD = 280 PKR`). Totals, budgets, and reports use the base currency. Supported codes include PKR, USD, EUR, GBP, AED, INR, SAR, CAD, and AUD.

## Backup & restore

Settings includes a full-account ZIP backup (separate from CSV export/import). Receipts are pulled from private Vercel Blob into the ZIP and written back to Blob on restore.

### Download backup

Use **Settings → Backup → Download backup**. The server builds:

```
expense-tracker-backup-YYYY-MM-DD.zip
├── data.json          # format version, createdAt, settings (base currency + rates),
│                      # categories, expenses, incomes, budgets, recurring items,
│                      # wallets, transfers, goals
└── receipts/          # JPEG, PNG, or PDF files referenced by expenses
```

Only the logged-in user’s data is included. The app records `lastBackupAt` and shows a gentle reminder if there has been no backup for 30 days. Current backups use format version **2**. Older format version **1** ZIPs (without wallets/transfers/goals) can still be restored; missing wallets and goals are treated as empty.

### Restore backup

Use **Settings → Restore** and upload a ZIP (max **50 MB**). The server validates format version, structure, field types, and that every referenced receipt exists (JPEG/PNG/PDF only; path traversal is rejected). Invalid files are rejected with a clear message and nothing is changed. The restore preview lists counts for categories, expenses, income, budgets, recurring items, wallets, transfers, goals, and receipts.

After a successful preview you can:

- **Merge** — keep current data; add missing categories/wallets/goals (by name), budgets, expenses, income, recurring items, and transfers
- **Replace** — delete current categories/expenses/income/budgets/recurring/wallets/transfers/goals/receipts and load the backup (requires typing `RESTORE`)

Restore runs in a database transaction. Restored rows always use the logged-in user’s id; ids from the file are remapped and never trusted as `userId`. Expense and income links to wallets are remapped the same way so they stay correct after restore. Receipt files are uploaded to private Vercel Blob; on replace, previous Blob objects are deleted after a successful commit.
