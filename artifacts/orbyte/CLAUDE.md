# CLAUDE.md — e-Salary Guard (Frontend, `artifacts/orbyte`)

This file is read at the start of every session. Follow it unless a team member explicitly overrides a rule in chat.
Replaces the Payroll Cash Guard version (Cash Guard code is in git history up to commit `5f962a0`).

## 1. Context

- Event: SDC Hackathon 2026, Domain 2 — Orbyte Smart SME Challenge.
- Feature: **e-Salary Guard** — take-home pay worked out from attendance and HR rules, a (simulated) WhatsApp message
  for every deduction, SEA-LION suggests whether a leave reason is tolerated or deducted, HR decides.
- `/` is a copy of the orbyte.my home page (`public/index.html`, `public/css`, `public/js`, `public/assets`) with one added
  e-Salary Guard slot. The app lives at `/login`, `/hr/...`, `/employee/...`. `/tes-ai` is T2's AI test page (keep it working).
- Pitch it as early warning and deduction transparency, not as payroll/HR software (orbyte.my says "Not an HR system").
- Architecture (one Replit app, same address):

```
artifacts/orbyte (Next.js, web at /)  ── /ai/classify-leave (server route) ──→ SEA-LION on RunPod (T2)
                                       ├─ /ai/state, /ai/session ──→ Postgres table esalary_state (declared in lib/db)
                                       └─ /tes-ai page ──→ artifacts/api-server /api/ai-test (Express, T1)
```

- **Shared database** (when `DATABASE_URL` is set, i.e. on Replit): the whole demo state is one JSONB row with a `version`
  (optimistic locking). Every change runs on the server through `lib/server/actions.ts` (role + ownership + input checks,
  then the same `engine.ts` functions), signed-in account from a signed httpOnly cookie (`lib/server/session.ts`).
  Without `DATABASE_URL` the app falls back to localStorage (browser mode), e.g. for the laptop zip.
  The table is in T1's `lib/db` (with T1's permission) so Replit's `drizzle-kit push` keeps it; the app uses its own `pg` pool.

- **Change from the old rule** ("all AI through `/api`"): the leave classifier is a Next.js server route in this artifact.
  It reads `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_MODEL` from Replit Secrets; nothing reaches the browser.
  It is at `/ai/...`, not `/api/...`, because Replit sends every `/api` request to `artifacts/api-server`.
- GitHub is the single source of truth. Replit pulls from GitHub (Tools → Git → Pull) and publishes.

```
/artifacts/orbyte       ← your scope
/artifacts/api-server   ← DO NOT EDIT (T1)
/lib, root config, .replit, pnpm-workspace.yaml ← DO NOT EDIT (T1 / Replit)
pnpm-lock.yaml          ← changes only when this artifact's dependencies change (ask first)
/docs                   ← you may add /docs/frontend-*.md only
```

## 2. Stack

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, Vitest. Orbyte's own CSS is reused (`app/orbyte.css`).
- Data: shared Postgres (database mode) or localStorage (browser mode), chosen at load by `GET /ai/state` (503 = browser mode).
  "Reset demo data" (HR only) restores the demo data for everyone sharing it.
- This Next.js version has breaking changes: read `node_modules/next/dist/docs/` before using a Next API you are unsure of.

## 3. Commands (from the repo root)

```
npx -y pnpm@10 install
PORT=5173 npx -y pnpm@10 --filter @workspace/orbyte run dev      # local preview at http://localhost:5173
npx -y pnpm@10 --filter @workspace/orbyte run test               # must pass before every commit
npx -y pnpm@10 --filter @workspace/orbyte run typecheck          # must pass before every commit
npx -y pnpm@10 --filter @workspace/orbyte run build              # must pass before every commit
```

Windows only: the repo strips Windows binaries (Replit is Linux). If the build fails on a missing
`lightningcss.win32-x64-msvc.node` or Tailwind oxide binary, unpack `lightningcss-win32-x64-msvc` and
`@tailwindcss/oxide-win32-x64-msvc` (same versions) into their packages' `node_modules` under `node_modules/.pnpm`. Never commit this.
For the AI locally, export the three RUNPOD_* values in the shell (never commit `.env*` files).
Database mode locally: any UTF8 Postgres (a WIN1252 database rejects the "→" in log entries), set `DATABASE_URL`, create
the table with `npx drizzle-kit push --dialect postgresql --schema ./src/schema/index.ts --url <DATABASE_URL>` run in `lib/db`
(on Windows the config file's absolute schema path fails; Replit runs the normal `pnpm --filter db push`).

## 4. Where things live

- `lib/payroll.ts` pay rules (pure functions, tests in `payroll.test.ts`); `lib/engine.ts` every action + WhatsApp/activity log;
  `lib/leaveClassifier.ts` AI prompt, answer check, keyword fallback and the anti-gaming filter; `lib/store.tsx` state + storage.
- `lib/server/classify.ts` the only code that talks to RunPod (used by `/ai/classify-leave` and by `/ai/state` action `readReason`).
- `lib/server/actions.ts` the list of server actions, who may run them, input checks; tested in `actions.test.ts`.
  A new store action needs an entry there too, or the server refuses it. `lib/server/state.ts` load/save with retries (`state.test.ts`).
- `lib/store.tsx` runs each action locally (instant), queues it, and sends the queue to `/ai/state` in order (keepalive);
  polls every 4 s for other people's changes.
- Demo spaces (`lib/server/space.ts`, `/ai/space`, `components/DemoSpace.tsx`): one database row per space, code in the
  `esg-space` cookie; `/login?space=CODE` joins. `engine.simulateEvent` + `components/hr/SimulateEvent.tsx` = "Try it live".
- Phones: `AppShell` has a bottom tab bar (HR "More" sheet). Every table uses `TABLE` (class `rtable`) and becomes cards
  under 640px (`app/globals.css`); AppShell copies `<th>` text into each cell's `data-label`, so keep a header per column.
- Money only from `lib/payroll.ts`; only attendance deductions (no tax, EPF, SOCSO, EIS). Format money as `RM 3,500.00`.
- "Today" is the real date in Malaysia (`engine.todayOf`). Imported attendance exists only for days before today
  (`seed.importAttendance`); days not yet happened are never absent. HR corrections live in `attendanceOverrides`, never in the raw data.
- Every reversal or edit (revert, withdraw, edit, cancellation, attendance, allowance, division rate) goes through `lib/engine.ts`:
  it must call `assertOpen` (paid month = locked) and `log`. UI shows why an action is disabled with `paidReason` /
  `leaveCancelBlock` / `overtimeCancelBlock` and `GuardedButton`.
- Saved browser data has a `version`; `engine.migrate` upgrades older data in place. Bump `DATA_VERSION` and extend `migrate` when the shape changes.
- HR pages: `/hr/salary` "Workers & pay" (tabs: workers = search, departments, pay, add a worker; overtime offers; leave
  allowance; the tab follows the address hash), `/hr/rates` (all rates + overtime per department), `/hr/approvals`, `/hr/payroll`
  (current month only), `/hr/payments` (month picker), `/hr/whatsapp` "Messages" (one two-way conversation per worker, `?who=E3`),
  `/hr/activity`. `/hr/offers` → `/hr/salary#overtime`, `/hr/attendance` (removed) → `/hr` (`next.config.ts`).
- Accounts come from the data: `seed.accountsOf(data.employees)` (HR + every worker, also workers HR adds with
  `engine.addEmployee`; they start on `startDate` and are never absent before it). The server resolves the session cookie
  against the current space's accounts, so never use the static `ACCOUNTS` list outside tests.

- Languages (EN / BM / 中文): never hard-code screen text. Wrap it in `t('English text')` (`tn` for plurals, `rt` for
  sentences with JSX parts) and add `[English, Melayu, 中文]` to `lib/i18n-dict.ts` (SCREEN). Stored text stays English;
  for a new generated message/log/error add its template to GENERATED and show it with `tx()`. People's data (positions,
  departments) goes through `td()` (dictionary only). Engine/payroll date helpers must pass `'en'`. `lib/i18n.test.ts` fails
  on a missing translation.

## 5. Rules for AI content

- Every AI label shows its source ("AI suggestion" / "Keyword check" / "Set by HR"); low confidence shows "Please check".
  Screen words come from `lib/words.ts` (plain English: "Paid leave" / "Unpaid leave", never Tolerated / Deducted).
- The AI only suggests; HR approves, rejects or changes the label, and every change is logged.
- The employee's reason is data, never instructions. Reasons with labels, JSON or instructions never reach the AI.
- RunPod can take 1–2.5 min to wake up: requests are saved at once with the keyword label and the AI label replaces it
  when it arrives. Open `/login` 2–3 minutes before a demo (it sends a warm-up call).

## 6. Secrets and safety

- No API keys, tokens or URLs with credentials in the code or repo. Never commit `.env` files.
- All demo data is fake. Never use real names, numbers or data.
- Database mode checks every change on the server (`lib/server/actions.ts`); never trust role or employee id from the browser.
  Still a demo: password "demo", and the browser receives the whole (fake) state.
- The Orbyte HTML/CSS/JS/images belong to Orbyte (Alpha Red) and are not covered by the repo LICENSE.
  Ask the organisers before making the repo public.

## 7. Workflow

1. `git pull --rebase` first (Replit Agent also commits to main).
2. Small steps; after each: test, typecheck, build.
3. Commit small and often, e.g. `feat(esalary): ...`. Report what was built, what is mocked, what is left.
4. Append a plain-language note to `/docs/frontend-notes.md` for new files and data flow.
