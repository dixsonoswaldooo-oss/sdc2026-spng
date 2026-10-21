# Requests from the frontend to the backend (T1)

Things the frontend needs that differ from, or add to, the original brief (§8). Nothing here is urgent for the demo:
the website runs on built-in demo data (`VITE_USE_MOCK=true`) until the backend is ready.

1. **`Breakdown.purchasesDue`** (new field): purchase orders paid before payday. Needed for the PO-077 fix agreed with Owen:
   PO-077 (RM 1,200) counts as money out, and the bank balance in the demo data is RM 7,400 instead of RM 6,200.
2. **`PurchaseOrder.dueDate`** (new field): the date the order is paid unless held.
3. **`ai.basedOn` is a list of `{ label, source }`** instead of plain strings, so each chip can link to its data.
   `source` is one of `PAYROLL | RECEIVABLES | BILLS | PURCHASES | SALES`.
4. **`GET /projection` returns `ProjectionResult`**: `{ points, withActions: { projectedAfterPayroll, gapToBuffer, status } }`.
   The what-if panel shows `withActions` as is; the frontend does no maths.
5. **`POST /run` answers when the check is finished** (up to ~60 s while the AI wakes up), not straight away.
6. **`Receivable.lastContactAt`** (new, optional): when the customer was last reminded; set when a chase is approved.
7. **`POST /actions/:id/submit` accepts `{ drafts }`**, so a Finance Admin's edited messages reach the Owner.
8. **Errors as `{ "error": "message" }`** with 400 / 403 / 404 / 409, and role checks on the server.
9. Switching to the real backend: set `VITE_USE_MOCK = "false"` in `artifacts/orbyte/.replit-artifact/artifact.toml`.

Full contract: `docs/frontend-api-contract.md`. Reference implementation of every rule: `artifacts/orbyte/src/mocks/engine.ts`.
