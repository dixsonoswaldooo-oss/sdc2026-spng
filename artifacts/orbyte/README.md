# e-Salary Guard (on an Orbyte copy)

A local preview for SDC 2026. `/` is a copy of the orbyte.my home page with one added slot, **e-Salary Guard**,
which opens its own sign-in page at `/login`.

e-Salary Guard works out each employee's take-home pay from attendance and HR rules, and sends a (simulated)
WhatsApp message the moment a deduction appears, so nobody is surprised on payday.

## Run it

Needs Node.js 20.9 or newer. In this repo it is the `@workspace/orbyte` artifact; use pnpm from the repo root:

```
npx -y pnpm@10 install
PORT=5173 npx -y pnpm@10 --filter @workspace/orbyte run dev
```

Open http://localhost:5173. Click **e-Salary Guard** in the top menu (or **Open e-Salary Guard** further down).
Other commands: `run test` (Vitest), `run typecheck`, `run build`. Windows notes are in `CLAUDE.md`.

**On Replit:** Tools → Git → Pull, then run the app (the artifact's `dev` command serves it at `/`), then Publish.
The RUNPOD_* values come from Replit Secrets. Every `/api` request goes to T1's `artifacts/api-server`, which is why
the leave classifier lives at `/ai/classify-leave`.

## Demo accounts

Password for all of them: `demo`. On the sign-in page, one click on a card signs you in.

| Who | Email | What to show |
|---|---|---|
| Nur Farah Hanim (HR) | farah@kopikawan.my | Dashboard, salary rules, approvals, payroll |
| Ahmad Faiz | ahmad@kopikawan.my | Perfect attendance |
| Tan Mei Ling | tan@kopikawan.my | Late, but inside the tolerance |
| Ravi Kumar | ravi@kopikawan.my | Late past the tolerance three times |
| Siti Aminah | siti@kopikawan.my | One absent day |
| Daniel Lee | daniel@kopikawan.my | Pending leave with an important reason |
| Nurul Izzah | nurul@kopikawan.my | Pending leave with a holiday reason |

All names, numbers and the company (Kopi Kawan Trading Sdn Bhd) are made up. Demo month: October 2026.
September 2026 is already paid. **Reset demo data** (in the header once signed in) puts everything back.

## AI for leave reasons (optional)

Without a key the app still works: leave reasons are labelled by keyword rules and marked **Fallback**.
To use SEA-LION on RunPod, copy `.env.example` to `.env.local` and fill in:

```
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=...
RUNPOD_MODEL=...   # the model name your RunPod endpoint serves (same value as in the team's Replit Secrets)
```

Restart `npm run dev` after changing it. The key is read only on the server (`app/ai/classify-leave/route.ts`)
and is never sent to the browser. Never commit `.env.local`.

Tested live on 2026-10-23 (model `sealion` = aisingapore/gemma-sea-lion-v3-9b-it): 8 of 8 normal reasons in English,
Malay and Indonesian labelled correctly, about 2 s each.

- **Cold start:** by default a RunPod endpoint keeps no worker running and lets one sleep 5 s after its last job, so the
  first answer can take 1–2.5 minutes. The app never makes the employee wait for that: after 8 s the request is saved with
  the keyword label, and the AI's label replaces it on its own when it arrives (unless HR already changed or decided it).
  Opening `/login` also sends a background warm-up call, so **open the sign-in page 2–3 minutes before a demo**.
  For no cold starts at all, set the endpoint's **Active workers to 1** in RunPod on demo day (billed while idle; set it back to 0 after).
- **Gaming the AI:** in tests the model could be talked into a label ("ignore previous instructions…", a fake
  "SYSTEM:" line). Reasons containing labels, JSON or instructions are therefore never sent to the AI: they get
  Deducted with low confidence and a **Needs review** badge for HR.

## How it is built

- Next.js App Router, TypeScript, Tailwind. No database: data lives in the browser (React context + localStorage).
- `lib/payroll.ts`: the pay rules as pure functions, tested in `lib/payroll.test.ts`.
  Only attendance deductions (late, absent, unpaid leave). No tax, EPF, SOCSO or EIS.
- `lib/engine.ts`: every action (approve, pay, change a rule) and the WhatsApp/activity-log side effects, tested in `lib/engine.test.ts`.
- `lib/leaveClassifier.ts`: the AI prompt, answer check and keyword fallback. The employee's reason is treated as data, not instructions.
- AI only suggests (tolerated / deducted). HR always decides and can change the label; every change is logged.
- Paying a month locks it (references `PAY-YYYYMM-NNN`). Payment is simulated: no money moves.
- Roles: an employee who opens an `/hr` page is sent back to their own dashboard and only sees their own data.
  This is a front-end demo; a real deployment must check roles on the server.
- `public/index.html`, `public/css`, `public/js`, `public/assets`: the Orbyte page, with only these changes:
  analytics beacon removed, links to other Orbyte pages point to orbyte.my, and the e-Salary Guard menu link,
  section and footer link added. The app pages reuse Orbyte's CSS and colours.

## Notes for the pitch

- Orbyte's own site says it is "Not an HR system". Pitch this as **early warning and deduction transparency**,
  not as payroll or HR software.
- The Orbyte HTML/CSS/JS and images in `public/` belong to Orbyte (Alpha Red) and are **not** covered by the repo's
  LICENSE. Fine while the repo is private; ask the organisers before publishing it.
