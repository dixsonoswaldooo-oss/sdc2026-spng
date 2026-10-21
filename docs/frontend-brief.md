# Build Prompt — Payroll Cash Guard UI

Paste this into Claude Code as the first task. CLAUDE.md in the repo contains the standing rules; follow both.

---

## 1. Your role and goal

You are a senior product designer and frontend engineer. Build the complete frontend for **Payroll Cash Guard**, a new AI feature inside a mock **Orbyte** workspace, for a hackathon demo judged by Orbyte's team.

The result must:
1. Look like a natural part of Orbyte, not a separate product.
2. Make one story crystal clear in under 2 minutes: *"Payday is coming, the money won't be enough, here is why, here is what to do, and nothing happens without the Owner's approval."*
3. Run fully in mock mode today, and switch to the real backend later by changing one env var.

## 2. Product summary

**Problem.** Many Malaysian SMEs discover too late that they can't cover payroll. Cash is tied up in unpaid customer invoices, and bills cluster in the same week as payday.

**What the agent does.** 7–10 days before payday it:
1. Reads payroll totals and payday from **Orbyte People**.
2. Reads bank balance, receivables and bills from **Orbyte Connect** (accounting) and average sales from Connect (POS).
3. Projects the cash balance on payday (computed by backend code, not by AI).
4. If there is a gap, the AI (SEA-LION on RunPod) explains the cause in plain language, ranks actions from a fixed menu, and drafts customer messages.
5. The Owner reviews, edits and approves. Only then are actions executed.

**Allowed action types (fixed menu):**
- `CHASE_RECEIVABLE` — send reminders for overdue invoices
- `RESCHEDULE_BILL` — move a supplier bill within its allowed terms, no penalty
- `HOLD_PURCHASE` — postpone a non-urgent purchase order until after payday

**Hard guardrail:** the product never proposes delaying or reducing salaries (Malaysian law requires timely wage payment). Show this as a locked rule in Settings.

## 3. Users and roles

Role switcher in the top bar (for the demo):

- **Owner** — sees everything, can approve/reject actions, can change settings.
- **Finance Admin** — sees everything, can edit drafts and "Submit for approval", cannot approve, settings read-only.

## 4. Demo scenario (mock data — must add up exactly)

Company: **Kopi Kawan Trading Sdn Bhd**, a coffee roaster supplying cafés and hotels in the Klang Valley. 14 employees.
Demo "today": **21 Oct 2026** (make configurable in fixtures). Payday: **25 Oct 2026**.
Settings: alert lead time 10 days, safety buffer **RM 2,000.00**, message language EN (BM available).

**Cash projection to payday**

| Item | Amount |
|---|---|
| Current bank balance | RM 6,200.00 |
| + Expected net sales until payday (30-day POS average) | RM 7,600.00 |
| + Receivables due by payday, likely paid | RM 2,800.00 |
| − Bills due by payday | RM 7,000.00 |
| = Balance on payday before payroll | **RM 9,600.00** |
| − Payroll (net pay + employer EPF/SOCSO/EIS, 14 staff) | RM 18,000.00 |
| = **Projected balance after payroll** | **−RM 8,400.00** |
| Needed to reach safety buffer | RM 10,400.00 |

**Receivables due by payday (counted in projection)**
- INV-1042 · Kafe Lorong · RM 1,500.00 · due 23 Oct 2026
- INV-1045 · Brew Lab KL · RM 1,300.00 · due 24 Oct 2026

**Overdue receivables (NOT counted in projection)** — total RM 9,200.00
- INV-1021 · Restoran Seri Melaka · RM 4,500.00 · due 30 Sep 2026 · 21 days overdue · pay likelihood 90%
- INV-1027 · Hotel Damai Cheras · RM 3,100.00 · due 9 Oct 2026 · 12 days overdue · pay likelihood 70%
- INV-1031 · Kafe Bunga Raya · RM 1,600.00 · due 13 Oct 2026 · 8 days overdue · pay likelihood 60%

**Bills due by payday** — total RM 7,000.00
- BILL-311 · Biji Emas Supplies (green beans) · RM 2,600.00 · due 23 Oct · terms allow moving to 2 Nov with no penalty → shiftable
- BILL-312 · Utilities · RM 900.00 · due 24 Oct · not shiftable
- BILL-313 · Shop lot rent · RM 3,500.00 · due 25 Oct · not shiftable

**Pending purchase orders**
- PO-077 · Packaging (bags & labels) · RM 1,200.00 · non-urgent, can order after payday

**Recommended actions (AI-ranked)**
1. `CHASE_RECEIVABLE` — 3 overdue invoices. Potential RM 9,200.00, expected RM 7,180.00 (4,050 + 2,170 + 960, weighted by likelihood). Confidence: medium.
2. `RESCHEDULE_BILL` — BILL-311 to 2 Nov. Frees RM 2,600.00 before payday. Confidence: high.
3. `HOLD_PURCHASE` — PO-077 until after payday. Frees RM 1,200.00. Confidence: high.

**Status logic** (projected balance after payroll = P, buffer = B):
- `SAFE` if P ≥ B
- `AT_RISK` if 0 ≤ P < B
- `SHORTFALL` if P < 0

Expected outcomes (mock engine must reproduce these):
- No actions: P = −8,400 → SHORTFALL
- Actions 1 + 2 (expected values): P = −8,400 + 7,180 + 2,600 = +1,380 → AT_RISK
- Actions 1 + 2 + 3: P = +2,580 → SAFE
- Demo "Simulate: customers pay" (all 3 overdue invoices paid in full) + action 2: P = −8,400 + 9,200 + 2,600 = +3,400 → SAFE

**AI explanation (fixture, EN):**
> Payroll of RM 18,000 is due on 25 Oct, but your projected balance that day is RM 9,600 — a gap of RM 8,400. The main cause is RM 9,200 in overdue customer invoices, while rent and supplier bills fall in the same week. Collecting the three overdue invoices and moving the Biji Emas bill to 2 Nov (allowed by its terms) should close the gap. Holding the packaging order adds a safety margin. No recommendation affects staff salaries.

**Draft message fixture (INV-1021, EN):**
> Hi Encik Faizal, hope business is going well. Just a friendly reminder that invoice INV-1021 (RM 4,500.00, due 30 Sep) is still open on our side. Could you let us know when we can expect payment? If it's already on the way, please ignore this — thank you! — Aina, Kopi Kawan Trading

**Same draft (BM):**
> Salam Encik Faizal, harap urusan berjalan lancar. Sekadar peringatan mesra, invois INV-1021 (RM 4,500.00, tarikh akhir 30 Sep) masih belum dijelaskan dalam rekod kami. Boleh maklumkan bila bayaran dijangka dibuat? Jika sudah dibuat, sila abaikan mesej ini. Terima kasih! — Aina, Kopi Kawan Trading

Write similar, natural drafts for INV-1027 and INV-1031 (polite, short, not pushy; firmer tone for older overdue).

## 5. Information architecture

**Orbyte shell (layout)**
- Left sidebar: workspace name, then modules — Home, People, Hiring, Work, eSign, Connect — then a section "Smart Features" containing **Cash Guard** (active, with a status dot + short label like "Shortfall").
- Other modules are non-functional placeholders (clicking shows a simple "Not part of this demo" page).
- Top bar: company name, credit wallet indicator (e.g. "Credits: 1,240"), role switcher (Owner / Finance Admin), user avatar initials.
- If `/design-ref` contains Orbyte screenshots, match their spacing, typography scale, sidebar style and colors as closely as possible. Do not copy logos as image files unless provided there; use a text wordmark.

**Cash Guard pages (tabs within the feature)**
1. Overview
2. Actions
3. Receivables
4. Bills & Purchases
5. Activity Log
6. Settings

## 6. Screen specifications

### 6.1 Overview
- **Status banner** at top: status pill (icon + text), headline e.g. "RM 8,400.00 short for payroll on 25 Oct", subline "4 days to payday · last checked 21 Oct, 08:00". Primary button "Review actions", secondary "Run check now".
- **Key figures row** (4 cards): Payroll due · Balance on payday (before payroll) · Projected after payroll · Gap to safety buffer.
- **Cash projection chart**: daily line from today to payday + 7 days. Show a payday marker, a zero line, and a dashed buffer line. Toggle: "Current" vs "If actions approved" (second line uses expected outcome of selected actions).
- **Breakdown** (waterfall chart or clean stacked list): balance → + sales → + receivables → − bills → − payroll → result. Each row links to its source tab.
- **AI explanation card**: AI badge, the explanation text, "Based on:" chips linking to the data (Payroll · 3 overdue invoices · 3 bills), model label "SEA-LION · RunPod", generated time. If fallback: show fallback badge and the rules-based text instead.
- **What-if panel**: checkboxes for the 3 actions; updates the projected result and status live (values come from engine/backend response, not computed in the component).

### 6.2 Actions
- List of action cards ranked by AI. Each card: type icon + label, title, impact (potential and expected RM), confidence, one-line reason, status (`PROPOSED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `EXECUTED`).
- Card expands into a detail panel/drawer:
  - `CHASE_RECEIVABLE`: table of invoices included (toggle each on/off), per-customer draft message in an editable textarea, language switch EN/BM, channel label (WhatsApp/email, display only), "Regenerate draft" button.
  - `RESCHEDULE_BILL`: current vs new due date, the term that allows it, penalty: none.
  - `HOLD_PURCHASE`: PO details and new suggested date.
- Buttons by role:
  - Owner: **Approve**, **Reject** (requires a short reason), Edit.
  - Finance Admin: Edit, **Submit for approval**.
- Approve shows a confirmation modal summarizing exactly what will happen ("3 messages will be queued for sending. Nothing is sent until you confirm."). After approval, show a success toast and update status and the Overview projection.

### 6.3 Receivables
- Table: invoice, customer, amount, due date, days overdue, likelihood, reminder status, last contact.
- Filters: All / Overdue / Due before payday. Sort by amount and days overdue.
- Overdue rows visually distinct (icon + text, not color only).

### 6.4 Bills & Purchases
- Two sections: Bills (due date, amount, shiftable yes/no with reason, penalty), Purchase orders (amount, urgency).

### 6.5 Activity Log
- Chronological audit trail: agent runs, data sources read, AI output generated (with fallback flag), edits, approvals/rejections with user + role + time, demo simulations.
- Each entry expandable to show details. This is our proof of human-in-the-loop for judges.

### 6.6 Settings
- Payday (day of month), alert lead time (days), safety buffer (RM), default message language (EN/BM), enabled action types (toggles for the 3).
- Locked row with lock icon: "Never propose delaying or reducing salaries" — always on, with a one-line explanation.
- Read-only for Finance Admin.

### 6.7 Demo controls
- A small floating "Demo" button (bottom-right), visible only when `VITE_DEMO_MODE=true`. Opens a panel with:
  - Run check now
  - Simulate: customers pay overdue invoices
  - Simulate: AI unavailable (forces fallback)
  - Reset demo data

## 7. States (required everywhere)

- **Agent running**: when "Run check now" is pressed, show a step-by-step progress list (≤ ~60s, the model may cold-start):
  1. Reading payroll from People
  2. Reading balances and invoices from Connect
  3. Projecting cash to payday
  4. Asking AI for explanation and actions
  In mock mode, simulate ~4 seconds total.
- **Loading**: skeletons, not spinners on blank pages.
- **Empty**: e.g. no overdue invoices → friendly message.
- **Safe state**: green status, short reassurance, no action list noise.
- **Error**: clear message + retry.
- **AI fallback**: results still shown, with "Fallback (rules-based)" badge and a note that drafts are templates.

## 8. API contract

Create `src/api/types.ts` and `/docs/frontend-api-contract.md` with these shapes (backend T1 will implement them):

```ts
type Money = number;            // RM, 2 decimals, computed by backend
type ISODate = string;          // "2026-10-25"
type Status = "SAFE" | "AT_RISK" | "SHORTFALL";
type ActionType = "CHASE_RECEIVABLE" | "RESCHEDULE_BILL" | "HOLD_PURCHASE";
type ActionStatus = "PROPOSED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED";
type Role = "OWNER" | "FINANCE_ADMIN";

interface CashGuardSummary {
  companyName: string;
  today: ISODate;
  payday: ISODate;
  daysToPayday: number;
  payrollTotal: Money;
  headcount: number;
  breakdown: { currentBalance: Money; expectedSales: Money; expectedReceivables: Money; billsDue: Money; balanceBeforePayroll: Money; projectedAfterPayroll: Money; };
  safetyBuffer: Money;
  gapToBuffer: Money;
  status: Status;
  lastCheckedAt: string;        // ISO datetime
  ai: { explanation: string; basedOn: string[]; model: string; generatedAt: string; isFallback: boolean; };
}

interface ProjectionPoint { date: ISODate; current: Money; withActions: Money; }

interface Receivable { id: string; customer: string; contactName: string; amount: Money; dueDate: ISODate; daysOverdue: number; likelihood: number; reminderStatus: "NONE" | "DRAFTED" | "SENT" | "REPLIED"; countedInProjection: boolean; }

interface Bill { id: string; vendor: string; description: string; amount: Money; dueDate: ISODate; shiftable: boolean; shiftableTo?: ISODate; termNote?: string; penalty: Money; }

interface PurchaseOrder { id: string; vendor: string; description: string; amount: Money; urgent: boolean; suggestedDate?: ISODate; }

interface DraftMessage { receivableId: string; language: "EN" | "BM"; channel: "WHATSAPP" | "EMAIL"; body: string; isFallback: boolean; }

interface Action {
  id: string; rank: number; type: ActionType; title: string; reason: string;
  potentialImpact: Money; expectedImpact: Money; confidence: "LOW" | "MEDIUM" | "HIGH";
  status: ActionStatus; relatedIds: string[]; drafts?: DraftMessage[];
}

interface AuditEvent { id: string; at: string; actor: string; role: Role | "AGENT" | "SYSTEM"; kind: string; summary: string; details?: Record<string, unknown>; }

interface Settings { paydayDayOfMonth: number; leadTimeDays: number; safetyBuffer: Money; defaultLanguage: "EN" | "BM"; enabledActions: ActionType[]; }
```

Endpoints:

```
GET  /api/cash-guard/summary
GET  /api/cash-guard/projection?actions=ACT-1,ACT-2
POST /api/cash-guard/run                     → { runId } then GET summary
GET  /api/cash-guard/actions
POST /api/cash-guard/actions/:id/submit      (FINANCE_ADMIN)
POST /api/cash-guard/actions/:id/approve     body: { drafts?: DraftMessage[] }   (OWNER)
POST /api/cash-guard/actions/:id/reject      body: { reason: string }            (OWNER)
POST /api/cash-guard/actions/:id/regenerate-draft  body: { receivableId, language }
GET  /api/receivables
GET  /api/bills
GET  /api/purchase-orders
GET  /api/audit
GET  /api/settings     PUT /api/settings
POST /api/demo/simulate-payments   POST /api/demo/simulate-ai-down   POST /api/demo/reset
```

Role is sent as header `X-Demo-Role` for the demo.

## 9. Design direction

**Feel:** calm, precise, trustworthy finance tool. Editorial clarity, generous whitespace, no decoration for its own sake. It should feel premium but native to a business SaaS.

**Tokens (CSS variables in `styles/tokens.css`, light mode first, dark mode optional):**
- Neutrals: background `#F7F7F5`, surface `#FFFFFF`, border `#E6E5E1`, text `#1A1A18`, muted text `#6B6A65`
- One accent for interactive elements: deep teal `#0F5C55` (hover `#0B4741`)
- Status: safe `#1F7A4D`, at-risk `#B26B00`, shortfall `#B42318` — used for pills, chart lines and icons only, never large fills
- AI accent: subtle violet `#5B4BC4` for the AI badge only
- Radius 10px cards, 8px inputs; shadows minimal (1 soft level)
- Font: Inter (Google Fonts), tabular numbers for all money; scale 12/14/16/20/28/36
- Spacing on a 4px grid; content max width ~1200px

If `/design-ref` shows Orbyte's real styles, Orbyte's styles win over these tokens.

**Copy tone:** plain English, short sentences, no jargon, no exclamation marks in system text. Numbers always with "RM" and 2 decimals. Never alarmist; factual and action-oriented.

## 10. Accessibility and responsiveness

- WCAG AA contrast, visible focus rings, all actions reachable by keyboard, modals trap focus and close with Esc.
- Charts have a text summary for screen readers.
- Desktop-first (judges use laptops) but fully usable at 390px: sidebar collapses to a menu, tables become stacked cards.

## 11. Build order (stop and report after each phase)

1. **Scaffold:** Vite + TS + Tailwind + Router, tokens, `format.ts`, env setup, `.env.example`, scripts.
2. **Shell:** Orbyte sidebar, top bar, role switcher, placeholder module pages.
3. **Data layer:** `types.ts`, fixtures, `engine.ts` (reproducing all expected outcomes in section 4), `client.ts` with mock/real switch, API contract doc.
4. **Overview page** with chart, breakdown, AI card, what-if panel.
5. **Actions page** with detail drawer, drafts, role-based buttons, approval modal.
6. **Receivables, Bills & Purchases, Activity Log, Settings.**
7. **Demo controls + all states** (running, loading, empty, error, fallback, safe).
8. **Polish:** responsive pass, accessibility pass, copy pass, final arithmetic check against section 4.

## 12. Acceptance criteria

- [ ] With mock data, Overview shows SHORTFALL, −RM 8,400.00 after payroll, and the AI explanation.
- [ ] What-if: actions 1+2 → AT_RISK +RM 1,380.00; 1+2+3 → SAFE +RM 2,580.00.
- [ ] Finance Admin cannot approve; Owner can. Every approval/rejection appears in the Activity Log.
- [ ] Drafts are editable, switchable EN/BM, and nothing is "sent" without the confirmation modal.
- [ ] "Simulate: AI unavailable" shows fallback content with a badge, no blank areas.
- [ ] "Simulate: customers pay" + action 2 approved → SAFE +RM 3,400.00.
- [ ] No UI anywhere offers delaying or reducing salaries; Settings shows the locked guardrail.
- [ ] Switching `VITE_USE_MOCK=false` makes all data go to the API base URL without code changes.
- [ ] Build, lint and typecheck pass. `/docs/frontend-notes.md` explains every file in plain language.
