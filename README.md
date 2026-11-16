# VAULT · Oiled Up Bros

VAULT is a private, in-house savings tracker. Members record bank transfers made outside the website, attach a receipt, and wait for the owner or administrator to verify the contribution. Only verified deposits enter the financial ledger.

The production application uses a React/Vite interface, a Node server, Prisma, Supabase Postgres, and a private Supabase Storage bucket. It does not require a custom domain or an email provider.

## Simple account model

- The exact `OWNER_EMAIL` receives the `owner` role.
- The exact `ADMIN_EMAIL` receives the `admin` role.
- The owner and administrator register with the temporary `BOOTSTRAP_CODE` and choose their own passwords.
- Other people can register directly without a code. If an existing valid
  invitation is supplied it is consumed, but an absent or stale code never
  blocks a member account.
- Password recovery uses a 30-minute reset code created by the owner or administrator inside VAULT.
- Passwords and setup codes are never stored in source control.

After the owner and administrator have registered, remove `BOOTSTRAP_CODE` from the deployed environment and redeploy. Their existing accounts continue working.

## Supabase setup

Create one Supabase project. In its SQL editor, create the dedicated Prisma user recommended by Supabase, then copy:

- The transaction pooler connection string on port `6543` into `DATABASE_URL` and append `?pgbouncer=true`.
- The session pooler connection string on port `5432` into `DIRECT_URL`.
- The project URL into `SUPABASE_URL`.
- The server-only Supabase secret key into `SUPABASE_SECRET_KEY`.

VAULT creates a private `vault-receipts` Storage bucket on first start or upload. The bucket accepts PNG, JPEG, WEBP, and PDF receipts up to 3 MB. This leaves room for encoding within Vercel's function request limit. Receipt requests still pass through VAULT's server authorization.

Copy the environment template and add the private values locally:

```sh
cp .env.example .env
```

```env
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_RECEIPTS_BUCKET=vault-receipts
OWNER_EMAIL=
ADMIN_EMAIL=
BOOTSTRAP_CODE=
```

The Prisma migrations enable Row Level Security without public policies on every VAULT table. The browser never receives database credentials or the Supabase server key.

## Run locally

Requires Node.js 24.20 or newer.

```sh
npm install
npm run db:deploy
npm run dev
```

Open `http://localhost:5173`.

Use `npm run dev` during development or `npm run preview` to build and run the
complete production-style application. `npm run preview:ui` serves only the
compiled interface; when used separately it expects the API server on port
5173 and proxies `/api` requests there.

## Deploy on Vercel

1. Import `Atomic-hacks/oiled-up-bros-vault` into Vercel.
2. Use the Vite framework preset and Node.js 24.x. The included `vercel.json`
   supplies the build command, output directory, and API routing.
3. Add the values from your private `.env` to Vercel's **Production** environment:
   `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `SUPABASE_RECEIPTS_BUCKET`, `OWNER_EMAIL`, `ADMIN_EMAIL`, and `BOOTSTRAP_CODE`.
   Never prefix these with `VITE_`. Do not copy `PORT` to Vercel.
4. Before deploying against a new database, run `npm run db:deploy` locally with
   its connection strings. Migrations are deliberately not run during Vercel
   preview builds, which could otherwise change the production database.
5. Deploy and open the generated `vercel.app` URL. `/api/health` should return
   `{"ok":true}`. Log in to existing accounts; the same Supabase database retains
   accounts created locally. If needed, register the owner/admin using the
   **existing** `BOOTSTRAP_CODE` value as the setup code and a separately chosen
   account password.
6. After both privileged accounts exist, remove `BOOTSTRAP_CODE` from Vercel and
   redeploy. Test a member deposit with a receipt, administrator verification,
   and member balance refresh before the group starts recording real funds.

Vite serves the interface and `api/index.mjs` adapts the existing Node request
handler to a Vercel Function. No separate API host or custom domain is needed.
`render.yaml` remains available if a persistent Node host is preferred.

Keep preview deployments disconnected from the production database, or give
them a separate Supabase test project. Password reset codes are issued inside
VAULT and shared privately; there is no email delivery integration.

## Release status

Build, lint, and automated tests are required before a release. Database-backed
financial integrity checks can be run with `npm run test:database`; they use a
transaction that is always rolled back, leaving no test records behind.
The first hosted deployment still needs a full receipt submission and review
check. Passing local checks does not by itself confirm Vercel configuration.

Member signup is open to anyone with the website URL. Invitation codes are
optional by request; financial data still requires login and is scoped to the
member. Reminders are in-app; there are no scheduled email/push notifications.

## Production data

The production database starts empty. The previous browser-local Tobi account, sample transactions, sample receipts, and sample notifications have been removed. Synthetic values remain only in automated tests.

Financial integrity rules are enforced on the server:

- Money is stored as integer kobo in PostgreSQL `BIGINT` columns.
- Pending and rejected deposits never enter the ledger.
- Verification changes the deposit, creates the ledger entry, notification, and audit event in one serializable transaction.
- A unique deposit-to-ledger relationship prevents duplicate verification.
- Withdrawals check the member's verified balance in a serializable transaction.
- Actual device prices are returned only from administrator endpoints.
- Receipt files are private and can be read only by their owner, the configured administrator, or the owner.

## Commands

```sh
npm test
npm run build
npm run db:status
npm run db:deploy
npm start
```

`npm test` covers exact money conversion, password hashing, setup-code comparison, goal edge cases, and exact owner/admin role assignment. Full database and Storage integration tests require the Supabase environment and should be run after those private values are added.
