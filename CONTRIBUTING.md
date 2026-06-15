# Contributing

## Active Code Paths

- Frontend changes go in `apps/web`.
- Worker/API changes go in `apps/api`.
- Database changes go in `database/d1` as numbered SQL migrations.

## Local Workflow

```powershell
npm install
Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars
npm run db:migrate:local
npm run dev:api
npm run dev:web
```

## Quality Gate

Run these before pushing:

```powershell
npm run typecheck
npm run build
```

## Deployment Notes

- Keep secrets out of git. Use `.dev.vars` locally and Wrangler/Vercel environment variables in production.
- Replace the D1 `database_id` in `apps/api/wrangler.toml` before deploying the Worker.
- Apply D1 migrations before deploying backend changes that depend on schema updates.
- Vercel should use `apps/web` as the project root.
- Create the first admin through `/admin` after setting the Worker `ADMIN_SETUP_TOKEN` secret.

## Commit Notes

Good commit prefixes:

```text
feat:
fix:
docs:
refactor:
chore:
```
