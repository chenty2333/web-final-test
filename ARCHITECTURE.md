# Architecture

## Product Surface

- `apps/web`: Next.js App Router frontend. Vercel hosts this app and serves both public pages and SSR/dashboard pages.
- `apps/api`: Cloudflare Worker API built with Hono. It owns authentication, ledger data, community features, monitoring data, and D1 writes.
- `database/d1`: D1 migrations. Database schema changes must be represented here.

## Request Flow

```text
Browser
  -> ledger.tychen.cc
  -> Next.js app on Vercel
  -> /api/backend/* route handler
  -> Cloudflare Worker API
  -> Cloudflare D1
```

The browser does not call the Worker directly for authenticated app actions. It calls the Next.js `/api/backend/*` proxy, which forwards cookies to the Worker. This keeps the frontend domain stable and avoids exposing session details to local storage.

## Data Boundary

- D1 is the source of truth.
- Worker DTOs convert database `snake_case` rows into frontend `camelCase` objects.
- The frontend should not write directly to D1 or depend on D1 table names.
- Local `.wrangler/state` is disposable development state and must not be committed.

## Deployment Boundary

- Vercel owns `ledger.tychen.cc`.
- Cloudflare Worker should use a separate API hostname, for example `ledger-api.tychen.cc`.
- Cloudflare D1 migrations should be applied before deploying Worker code that depends on new tables or columns.
- The first admin account is created through `/api/admin/bootstrap` with `ADMIN_SETUP_TOKEN`; after that, admin-only routes require a logged-in user with `role = 'admin'`.

## Required Checks

```powershell
npm run typecheck
npm run build
```
