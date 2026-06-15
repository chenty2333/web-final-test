# Starry Ledger

星芒账本是一个 Next.js + Cloudflare Workers + D1 的个人账本产品。

## Repository Layout

```text
apps/web      Next.js frontend, deployed to Vercel
apps/api      Cloudflare Workers API, backed by D1
database/d1   D1 SQL migrations
```

The production frontend domain is `https://ledger.tychen.cc`. The API is intended to run on a separate Worker domain such as `https://ledger-api.tychen.cc`.

## Requirements

- Node.js 22+
- npm
- Cloudflare account with Workers and D1 enabled
- Vercel account for the Next.js frontend

## Local Development

Install dependencies:

```powershell
npm install
```

Create local Worker variables:

```powershell
Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars
```

Apply local D1 migrations:

```powershell
npm run db:migrate:local
```

Start the Worker and the web app in separate terminals:

```powershell
npm run dev:api
npm run dev:web
```

Local URLs:

```text
Web: http://localhost:3000
API: http://127.0.0.1:8787
```

## Production Setup

Create the D1 database:

```powershell
Push-Location apps/api
npx wrangler login
npx wrangler d1 create starry-ledger
Pop-Location
```

Copy the returned `database_id` into `apps/api/wrangler.toml`.

Set Worker secrets:

```powershell
Push-Location apps/api
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_SETUP_TOKEN
npx wrangler secret put SEED_TOKEN
Pop-Location
```

Apply remote migrations and deploy the Worker:

```powershell
npm run db:migrate:remote
npm run deploy:api
```

Deploy the Vercel frontend from `apps/web` with:

```text
Root Directory: apps/web
Build Command: npm run build
Environment: API_BASE_URL=https://ledger-api.tychen.cc
```

Then bind `ledger.tychen.cc` to the Vercel project.

## Verification

Run this before pushing or deploying:

```powershell
npm run typecheck
npm run build
```

After deploying the Worker:

```text
https://ledger-api.tychen.cc/api/health
```

After deploying the frontend:

```text
https://ledger.tychen.cc
https://ledger.tychen.cc/login
https://ledger.tychen.cc/app
```

## Admin Setup

The first administrator is not hard-coded. Set `ADMIN_SETUP_TOKEN` in Worker secrets, then open:

```text
https://ledger.tychen.cc/admin
```

Use the setup token once to create the first admin account. Admin passwords must be at least 12 characters. After an admin exists, role changes are handled from the admin console.
