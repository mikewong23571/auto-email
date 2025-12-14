Title: Cloudflare Mail Cleaner – Tech Stack, Architecture & API (Cloudflare-only)
Scope: Align with product_brief.md (single user, receive/search/delete, no attachments/multimedia, 30-day retention).

Backend (Cloudflare Worker)
- Single Worker exposes both email and fetch handlers.
- Parser: postal-mime v2.6.x 开源版（AGPL）；固定版本；仅保留 text/html，丢弃附件/内联媒体；设 maxNestingDepth / maxHeadersSize。
- Storage: Cloudflare D1 + FTS5 for Subject/From/To/Body search；当前无自动 TTL，依赖用户通过 UI/API 删除；如需自动清理再加 cron/脚本。
- Auth: Single Bearer token (env var) required on all fetch endpoints；`/ingest` 仅由同一 Worker 的 email 入口内部调用，不对外暴露。
- Validation: Zod schemas for all request params/bodies and response shapes; type inference to handlers.
- Typecheck: TypeScript strict=true; use @cloudflare/workers-types; run `pnpm lint` + `pnpm typecheck` in CI.
- Error handling: Structured error helper -> status/code/message; never leak stack to client; log with request id.

Frontend
- Optional static SPA served via Cloudflare Pages hitting same Worker API.
- Stack: React + TypeScript + Vite + Tailwind (utility) + TanStack Query for data fetching.
- Auth: Bearer token stored in session storage; injected in fetch client.

Lint/Format/Test
- Lint/format: Biome (eslint+prettier alternative) single tool; consistent for worker & web.
- Typecheck: `pnpm typecheck` runs tsc for worker and web.
- Unit tests: Vitest (worker utils) + MSW for API mocks; Playwright optional for web smoke.

Directory Layout
- /worker
  - /src/handlers/email.ts          # email handler using postal-mime
  - /src/handlers/http.ts           # fetch router
  - /src/routes/messages.ts         # REST endpoints
  - /src/db/schema.sql              # D1 schema (messages, messages_fts)
  - /src/db/client.ts               # D1 binding helper
  - /src/schemas/*.ts               # Zod request/response schemas
  - /src/types/*.ts                 # shared DTO types (zod.infer)
  - /src/utils/html.ts              # sanitize/extract main html/text
  - /src/utils/errors.ts            # error helpers
  - wrangler.toml                   # bindings: D1, secrets (TOKEN), vars (TTL_DAYS)
- /web
  - /src/api/client.ts              # fetch wrapper with token
  - /src/api/types.ts               # generated from Zod (or OpenAPI if exported)
  - /src/components/*               # UI components (list, detail, search)
  - /src/pages/*                    # routes
  - /src/hooks/useMessages.ts       # data fetching/query hooks
  - /src/styles/*                   # Tailwind config & globals
- /scripts
  - seed.ts / cleanup.ts            # local dev seeding / TTL purge
- /config
  - biome.json, tsconfig.*.json, vitest.config.ts

Data Model (D1)
- messages: id TEXT PK (UUID), to_addr TEXT, from_addr TEXT, subject TEXT, body_text TEXT, body_html TEXT, received_at INTEGER (epoch seconds).
- messages_fts: FTS5(subject, body_text, body_html, from_addr, to_addr).

API (REST, JSON; Authorization: Bearer <token>)
- GET /messages?to=&q=&limit=&offset= -> [{id,to,from,subject,received_at,has_html,preview}]
- GET /messages/latest?to=&n= -> latest n for recipient.
- GET /messages/{id} -> metadata + body_text/body_html.
- DELETE /messages/{id} -> remove one.
- POST /messages/batch-delete { ids: string[] } -> remove multiple.
- POST /ingest (internal) -> email handler writes via shared function; not public/unauthenticated.

Email Handling
- Input: message.raw (ReadableStream). PostalMime.parse(raw, opts).
- Extract text else sanitized html; drop attachments/multimedia; reject oversize/over-limit emails.
- Insert into messages + messages_fts；当前无自动 TTL，靠人工删除（UI/API）。 

Limits & Safety
- Size guard (e.g., >10MB drop), parse limits, HTML sanitize (strip scripts/handlers), single-use parser, structured logging.

Out of Scope (per brief)
- Sending/reply SMTP, attachment/multimedia storage, multi-tenant/complex auth, spam/virus scanning, long-term archive.
