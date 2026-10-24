# Orbyte Plug-in

Orbyte Cash Guard is a cash-flow planning and approval demo for SDC Hackathon 2026.

## Run & Operate

- Start `artifacts/orbyte: web` and `artifacts/api-server: API Server` using their managed workflows.
- `pnpm --filter @workspace/orbyte run test` — run cash-flow engine and formatting tests on Node 20 using tsx.
- `pnpm --filter @workspace/orbyte run typecheck` — check the frontend.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Cash Guard uses the existing browser demo data by default; no database credentials are required for the demo.
- The optional `/tes-ai` page needs server-only `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, and `RUNPOD_MODEL` for live AI responses. Without them it returns its existing friendly unavailable message.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `src/apps/orbyte/` — Next.js application source for e-Salary Guard. Replit registration remains at `artifacts/orbyte/.replit-artifact/artifact.toml`.
- `src/apps/api-server/` — Express health and AI-test endpoints. Replit registration remains at `artifacts/api-server/.replit-artifact/artifact.toml`.
- `src/apps/mockup-sandbox/` — component preview application source. Its Replit registration remains under `artifacts/mockup-sandbox/`.
- `src/lib/` — shared API and database workspace packages.
- `docs/frontend-api-contract.md` — Cash Guard API contract for future backend integration.
- `src/.migration-backup/` — older Next.js starter; not the current application.

## Architecture decisions

- Preserve the newer Cash Guard frontend rather than overwriting it with the older starter in `src/.migration-backup`.
- Artifact metadata owns workflow ports and preview routing; do not add duplicate workflows or run root-level `pnpm dev`.

## Product

Cash-flow overview, action scenarios and role-based demo approval flows. See `docs/frontend-notes.md` for existing implemented and deferred screens.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
