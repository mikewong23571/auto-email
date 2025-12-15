# Cloudflare Mail Cleaner

Full-stack app that ingests email via a Cloudflare Worker, stores metadata in D1, and serves a React (Vite) UI for browsing and cleaning messages.

## Stack
- Cloudflare Worker + Hono
- Cloudflare D1 + Assets binding for the SPA
- React 19, Vite, Tailwind v4
- pnpm workspaces (packages: `worker`, `web`)

## Prerequisites
- Node 18+ and pnpm 9 (`corepack enable` recommended)
- Cloudflare Wrangler CLI (`npm i -g wrangler`)
- A Cloudflare account with a D1 database (IDs already referenced in `worker/wrangler.toml`)

## Setup
```bash
pnpm install
```

## Development
- Worker (miniflare + D1 preview): `pnpm --filter worker dev`
- Web client (Vite dev server): `pnpm --filter web dev`
- Build web assets: `pnpm --filter web build` (outputs to `web/dist`, served by the Worker)

## API Access
- Production API base: `https://auto-email.styleofwong.com/api`. CLI defaults to this URL unless `--base` or `API_BASE` overrides are provided.
- CLI commands support `--json` to display any API response as pretty JSON (useful for scripting).

## Quality Checks (run from repo root)
- Format: `pnpm format`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests (vitest): `pnpm test`

## Deployment
1) Set secrets (example): `cd worker && wrangler secret put API_TOKEN`
2) Deploy preview/prod: `pnpm --filter worker deploy` (add `--env production` for prod)

## Notes
- Local Cloudflare state is ignored via `.gitignore` (`.wrangler/`), so preview DB files stay local.
- Workspace entrypoint is the repo root; individual package scripts can also be run via `cd worker` or `cd web` if preferred.
