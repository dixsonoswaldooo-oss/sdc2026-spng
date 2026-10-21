# Frontend notes

Plain-language guide to the Cash Guard frontend, so anyone on the team can explain any part of it to the judges.
A new section is added after each build phase.

## Where the frontend lives

This repo holds one Replit app with two parts:

| Folder | What it is | Address |
|---|---|---|
| `artifacts/orbyte` | The website people see (our Cash Guard screens). | `/` |
| `artifacts/api-server` | The backend (T1): data, rules, calls to the AI on RunPod. | `/api` |

Both run on the same `.replit.app` link, so the website can reach the backend without any extra setup.

## How to update the live link

GitHub does not push to Replit by itself. After code is pushed to GitHub:

1. In Replit: **Tools → Git → Pull**. The preview restarts with the new code.
2. For the link the judges open: **Tools → Publishing → Publish**.

## The settings

Set in `artifacts/orbyte/.replit-artifact/artifact.toml` under `[services.env]`. They are public (they end up in the web page), never put keys there.

| Setting | What it does | If missing |
|---|---|---|
| `VITE_USE_MOCK` | `true`: use the built-in demo data. `false`: ask the real backend. | Demo data |
| `VITE_API_BASE_URL` | Backend address when demo data is off. Empty means "the same server" (`/api`). | Same server |
| `VITE_DEMO_MODE` | `true`: show the floating Demo button (bottom-right). | Button hidden |

---

## Phase 1: Foundations

**What was built:** colours and fonts, and the rules for showing money and dates. No real screens yet: the page at `/` is a temporary check page. The AI test page (`/tes-ai`) still works.

| File (in `artifacts/orbyte`) | In plain words |
|---|---|
| `src/styles/tokens.css` | The design tokens: every Cash Guard colour, as a variable. |
| `tailwind.config.ts` | Turns the tokens into classes such as `bg-accent`, `text-title`, `rounded-card`. Tailwind's default colours stay available for the older pages. |
| `src/index.css` | Loads the tokens and Tailwind; sets the page background, text colour, Inter font and the focus ring keyboard users see. |
| `src/lib/format.ts` | Turns numbers into `RM 8,400.00` and dates into `25 Oct 2026`. Every screen uses it. |
| `src/lib/format.test.ts` | Automatic checks for `format.ts` (`pnpm --filter @workspace/orbyte run test`). |
| `src/lib/env.ts` | Reads the settings above, in one place. |
| `src/vite-env.d.ts` | Tells TypeScript the names of those settings, so a typo is caught. |
| `src/pages/scaffold-check.tsx` | Temporary check page. Replaced by the Orbyte shell in Phase 2. |
| `CLAUDE.md` | Standing rules for anyone (or any AI) writing code here. |

### Decisions worth knowing

- **We kept the repo's existing tools** (React 19, wouter, Tailwind 3) instead of the ones in the original frontend brief. Swapping them would risk breaking the working Replit setup.
- **The at-risk colour is `#985B00`, not the brief's `#B26B00`.** The brief's colour is too light for small text under WCAG AA (4.2:1, needs 4.5:1). The new one is 5.5:1.
- **Dates are built from a fixed month list**, because browsers now write September as "Sept". This also stops a viewer's time zone from shifting a date by a day.
- **Money uses a true minus sign**, as in the brief: `−RM 8,400.00`.
- **PO-077 fix (agreed with Owen):** in the brief, the RM 1,200 packaging order was never counted as money going out, yet "Hold purchase" claimed to save RM 1,200. From Phase 3 it counts as money out before payday, and the bank balance becomes RM 7,400 instead of RM 6,200, so every headline number in the brief stays the same (−8,400, +1,380, +2,580, +3,400).
- **No lint check yet:** adding a linter would change the shared install file used by the whole team.
