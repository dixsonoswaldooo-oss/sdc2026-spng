# Cash Guard API contract (frontend ⇄ backend)

Source of truth for the shapes: `src/apps/orbyte/src/api/types.ts`. Change both in the same commit.
The mock engine (`src/apps/orbyte/src/mocks/engine.ts`) implements this contract and its tests
(`engine.test.ts`) show the expected numbers. T1 can copy its business rules.

## General

- All paths are on the same server as the website (`/api/...`).
- Every request carries the header `X-Demo-Role: OWNER | FINANCE_ADMIN`. **Check it on the server**, not only in the UI.
- Errors: non-2xx status with JSON `{ "error": "Plain-language message" }`. Use 400 (bad input), 403 (wrong role),
  404 (not found), 409 (already decided). The UI shows the message as is.
- Money: numbers in RM with 2 decimals, computed by the backend. Dates: `"2026-10-25"`. Date-times: ISO with offset.
- The UI waits up to 15 s per request, 75 s for `POST /run`, 60 s for regenerate-draft.

## Types

See `types.ts` for full field lists: `CashGuardSummary`, `Breakdown`, `BasedOn`, `ProjectionPoint`, `ProjectionResult`,
`Receivable`, `Bill`, `PurchaseOrder`, `DraftMessage`, `Action`, `AuditEvent`, `Settings`.

## Endpoints

| Method | Path | Body | Returns | Who |
|---|---|---|---|---|
| GET | `/api/cash-guard/summary` | – | `CashGuardSummary` | both |
| GET | `/api/cash-guard/projection?actions=ACT-1,ACT-2` | – | `ProjectionResult` | both |
| POST | `/api/cash-guard/run` | – | `{ runId }` **after** the check has finished | both |
| GET | `/api/cash-guard/actions` | – | `Action[]` sorted by rank | both |
| POST | `/api/cash-guard/actions/:id/submit` | `{ drafts?: DraftMessage[] }` | `Action` | FINANCE_ADMIN |
| POST | `/api/cash-guard/actions/:id/approve` | `{ drafts?: DraftMessage[] }` | `Action` | OWNER |
| POST | `/api/cash-guard/actions/:id/reject` | `{ reason: string }` (required) | `Action` | OWNER |
| POST | `/api/cash-guard/actions/:id/regenerate-draft` | `{ receivableId, language }` | `DraftMessage` | both |
| GET | `/api/receivables` | – | `Receivable[]` | both |
| GET | `/api/bills` | – | `Bill[]` | both |
| GET | `/api/purchase-orders` | – | `PurchaseOrder[]` | both |
| GET | `/api/audit` | – | `AuditEvent[]` newest first | both |
| GET / PUT | `/api/settings` | `Settings` (PUT) | `Settings` | GET both, PUT OWNER |
| POST | `/api/demo/simulate-payments` | – | 204 | both |
| POST | `/api/demo/simulate-ai-down` | – | 204 | both |
| POST | `/api/demo/reset` | – | 204 | both |

## Business rules the numbers depend on

- Projection window: today to payday + 7 days. Daily sales = 30-day POS average, from tomorrow.
- Invoices not yet overdue count in full on their due date. Overdue invoices count only after a reminder is sent
  (approved CHASE_RECEIVABLE), weighted by `likelihood`, expected 2 days later.
- Bills and purchase orders leave on their `dueDate`. Approving RESCHEDULE_BILL moves the bill to `shiftableTo`;
  approving HOLD_PURCHASE moves the order to `suggestedDate`.
- Status from projected balance after payroll P and buffer B: `SAFE` if P ≥ B, `AT_RISK` if 0 ≤ P < B, `SHORTFALL` if P < 0.
  `gapToBuffer = max(0, B − P)`.
- Approve = status `APPROVED`, apply the effect, then `EXECUTED`. Log both (`ACTION_APPROVED`, `ACTION_EXECUTED`).
- For CHASE_RECEIVABLE, the invoices chased are the `receivableId`s of the drafts sent with approve.
- `potentialImpact` / `expectedImpact` are recomputed from current data (expected for chase = Σ amount × likelihood).
- Never propose delaying or reducing salaries.
- When the AI fails or takes over 20 s: rules-based explanation and template drafts, with `isFallback: true`.
- After any change in the numbers (approval, payment, settings) rewrite the explanation, so it never contradicts the status.

## Audit `kind` values

`AGENT_RUN`, `DATA_READ`, `PROJECTION`, `AI_OUTPUT`, `DRAFT_GENERATED`, `ACTION_SUBMITTED`, `ACTION_APPROVED`,
`ACTION_REJECTED`, `ACTION_EXECUTED`, `SETTINGS_CHANGED`, `DEMO_SIMULATION`.

## Expected demo numbers (must match `engine.test.ts`)

| Situation | Projected after payroll | Status |
|---|---|---|
| No actions | −8,400.00 | SHORTFALL |
| Actions 1 + 2 (expected) | +1,380.00 | AT_RISK |
| Actions 1 + 2 + 3 | +2,580.00 | SAFE |
| Customers pay + action 2 | +3,400.00 | SAFE |
