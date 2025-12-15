# Repository Guidelines

## Project Structure & Module Organization
- Root uses pnpm workspaces. Key packages: `worker/` (Cloudflare Worker + D1 + Hono) and `web/` (React 19 + Vite + Tailwind v4).
- Shared configs live in `config/` (tsconfig, biome, vitest). Repo-level scripts are declared in `package.json`.
- Built SPA assets are output to `web/dist/` and served by the Worker via the `ASSETS` binding. Local Cloudflare state stays under `**/.wrangler/` (ignored).

## Build, Test, and Development Commands
- Install deps: `pnpm install`.
- Format: `pnpm format` (Biome formatter).
- Lint: `pnpm lint` (Biome lint).
- Typecheck: `pnpm typecheck` (tsc -b for the monorepo).
- Tests: `pnpm test` (vitest, config in `config/vitest.config.ts`).
- Dev servers: `pnpm --filter worker dev` (miniflare + D1 preview), `pnpm --filter web dev` (Vite).
- Build web: `pnpm --filter web build`; deploy Worker: `pnpm --filter worker deploy [--env production]`.

## Coding Style & Naming Conventions
- TypeScript everywhere; strict mode enabled. Two-space indentation, LF endings, 100-char line width (Biome). Imports are auto-organized.
- Prefer descriptive camelCase for variables/functions, PascalCase for types/components, SCREAMING_SNAKE_CASE for environment vars.
- React components live under `web/src/components/`; hooks under `web/src/hooks/`; styles in `web/src/styles/` (design tokens + component utilities).

## Testing Guidelines
- Vitest with globals (`vitest/globals`). Place specs alongside code using `*.test.ts` or `*.spec.ts`.
- Aim to cover parsing, routing, and schema validation (zod) paths. For Worker logic, prefer unit tests over integration unless D1 fixtures are added.
- Run `pnpm test` before submitting.

## Commit & Pull Request Guidelines
- Use concise, lower-case conventional prefixes (e.g., `feat:`, `fix:`, `chore:`, `docs:`). Keep subject lines under ~72 chars.
- Scope commits to a logical change set; include formatting changes with the code they touch.
- PRs: describe intent, list key changes, and note testing (`pnpm format && pnpm lint && pnpm typecheck && pnpm test`). Add screenshots/GIFs for UI changes and mention any config/secret steps.

## Security & Configuration Tips
- Secrets stay in Wrangler (`wrangler secret put ...`); never commit tokens. `worker/wrangler.toml` references D1 DB IDs—avoid editing IDs unless rotating resources.
- Keep `.wrangler/` local. If adding new env vars, mirror defaults in `[vars]` and document in `README.md`.
