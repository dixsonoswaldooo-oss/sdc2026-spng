// The only door to data. Mock mode calls the fake engine; real mode calls the backend at /api.
// Switch with VITE_USE_MOCK (src/lib/env.ts). Components never call fetch directly.
import { API_BASE_URL, SHEET_ID, USE_MOCK } from '@/lib/env';
import * as engine from '@/mocks/engine';
import { DEFAULT_SCENARIO } from '@/mocks/fixtures';
import { fetchSheetScenario, SheetError } from '@/mocks/sheet';
import { ApiError } from './errors';
import type {
  Action, AuditEvent, Bill, CashGuardSummary, DraftMessage, Language, ProjectionResult, PurchaseOrder,
  Receivable, Role, Settings, Workspace,
} from './types';

// ---------- who is clicking (sent as X-Demo-Role) ----------

let role: Role = 'OWNER';
export const setRole = (next: Role) => {
  role = next;
};

// ---------- change notifications: after any change, screens reload their data ----------

let version = 0;
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getVersion = () => version;
const changed = () => {
  version += 1;
  listeners.forEach((l) => l());
};

// ---------- transport ----------

const MOCK_DELAY_MS = 350; // long enough to show loading states
const RUN_DELAY_MS = 4000; // brief §7: a mock check takes about 4 seconds
const STORAGE_KEY = 'cash-guard-demo';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- where the demo data comes from: the Google Sheet (VITE_SHEET_ID) or the built-in data ----------

export interface DataSource {
  kind: 'sheet' | 'builtin';
  error?: string; // why the sheet could not be used at start (built-in data shown instead)
  newEditProblem?: string; // the latest sheet edit is wrong; the previous data stays on screen
  updateWaiting?: boolean; // the sheet changed after someone approved or simulated something
}

const SHEET_CHECK_MS = 15_000;
let source: DataSource = { kind: 'builtin' };
let ready = false;
let touched = false; // someone approved, rejected, submitted or simulated since the data was loaded

const clearSaved = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing saved to clear
  }
};

async function loadSheet(): Promise<void> {
  if (!USE_MOCK || !SHEET_ID) return;
  try {
    engine.loadScenario(await fetchSheetScenario(SHEET_ID));
    source = { kind: 'sheet' };
  } catch (error) {
    engine.loadScenario(DEFAULT_SCENARIO);
    source = { kind: 'builtin', error: error instanceof SheetError ? error.message : 'Could not read the Google Sheet.' };
  }
  touched = false;
}

/**
 * Checks the Google Sheet for edits. Untouched demo: the new data is shown straight away.
 * After approvals or simulations: a message offers to load it, so a demo in progress is never wiped by surprise.
 */
async function checkSheet(): Promise<void> {
  if (!ready || !USE_MOCK || !SHEET_ID || document.visibilityState !== 'visible') return;
  try {
    const next = await fetchSheetScenario(SHEET_ID);
    if (JSON.stringify(next) === JSON.stringify(engine.getScenario())) {
      if (source.newEditProblem) {
        source = { ...source, newEditProblem: undefined };
        changed();
      }
      return;
    }
    if (touched) {
      source = { ...source, newEditProblem: undefined, updateWaiting: true };
    } else {
      engine.loadScenario(next);
      clearSaved();
      source = { kind: 'sheet' };
    }
  } catch (error) {
    if (!(error instanceof SheetError)) return; // offline for a moment: try again next time
    if (source.kind === 'builtin') source = { ...source, error: error.message }; // still broken since start
    else source = { ...source, newEditProblem: error.message };
  }
  changed();
}

// Mock data survives a page refresh in this browser tab, so a reload during the demo keeps approvals,
// unless the sheet has changed since; then the demo starts fresh from the new data.
const started = (async () => {
  await loadSheet();
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (USE_MOCK && saved) {
      if (engine.importState(saved)) touched = true;
      else clearSaved();
    }
  } catch {
    // storage blocked (private mode) or an old save: the demo simply starts fresh
  }
  ready = true;
  changed();
  if (USE_MOCK && SHEET_ID) {
    setInterval(checkSheet, SHEET_CHECK_MS);
    document.addEventListener('visibilitychange', checkSheet); // e.g. coming back from editing the sheet
  }
})();

export const getDataSource = (): DataSource => source;

/** Reads the Google Sheet again and restarts the demo from it (Demo panel and notice buttons). */
export async function reloadFromSheet(): Promise<DataSource> {
  await started;
  await loadSheet();
  clearSaved();
  changed();
  return source;
}

interface MockOptions {
  delay?: number;
  mutates?: boolean; // changes data: save it and refresh every screen
  touches?: boolean; // counts as someone using the demo (defaults to mutates)
}

async function mock<T>(work: () => T, { delay = MOCK_DELAY_MS, mutates = false, touches }: MockOptions = {}): Promise<T> {
  await started;
  await sleep(delay);
  const result = structuredClone(work()); // screens get copies, never the engine's own data
  if (touches ?? mutates) touched = true;
  if (mutates) {
    try {
      sessionStorage.setItem(STORAGE_KEY, engine.exportState());
    } catch {
      // not saved; the demo still works until a refresh
    }
    changed();
  }
  return result;
}

async function http<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, { timeoutMs = 15_000, mutates = false } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Demo-Role': role },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check the connection and try again.');
  }
  const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  if (mutates) changed();
  return data as T;
}

// ---------- endpoints (docs/frontend-api-contract.md) ----------

const CG = '/api/cash-guard';

/** The Orbyte workspace around the feature is simulated in both modes. */
export const getWorkspace = (): Workspace | undefined => (ready ? engine.getWorkspace() : undefined); // undefined while the sheet loads

export const getSummary = () =>
  USE_MOCK ? mock(engine.getSummary) : http<CashGuardSummary>('GET', `${CG}/summary`);

export const getProjection = (actionIds: string[]) =>
  USE_MOCK ? mock(() => engine.getProjection(actionIds)) : http<ProjectionResult>('GET', `${CG}/projection?actions=${encodeURIComponent(actionIds.join(','))}`);

/** Waits for the whole check (the AI may cold-start, so up to ~60 s in real mode). */
export const runCheck = () =>
  USE_MOCK ? mock(engine.runCheck, { delay: RUN_DELAY_MS, mutates: true, touches: false }) : http<{ runId: string }>('POST', `${CG}/run`, undefined, { timeoutMs: 75_000, mutates: true });

export const getActions = () => (USE_MOCK ? mock(engine.getActions) : http<Action[]>('GET', `${CG}/actions`));

export const submitAction = (id: string, drafts?: DraftMessage[]) =>
  USE_MOCK ? mock(() => engine.submitAction(id, role, drafts), { mutates: true }) : http<Action>('POST', `${CG}/actions/${id}/submit`, { drafts }, { mutates: true });

export const approveAction = (id: string, drafts?: DraftMessage[]) =>
  USE_MOCK ? mock(() => engine.approveAction(id, role, drafts), { mutates: true }) : http<Action>('POST', `${CG}/actions/${id}/approve`, { drafts }, { mutates: true });

export const rejectAction = (id: string, reason: string) =>
  USE_MOCK ? mock(() => engine.rejectAction(id, role, reason), { mutates: true }) : http<Action>('POST', `${CG}/actions/${id}/reject`, { reason }, { mutates: true });

/** Not a "change" for the other screens: the draft stays local until submitted or approved. */
export const regenerateDraft = (actionId: string, receivableId: string, language: Language) =>
  USE_MOCK
    ? mock(() => engine.regenerateDraft(receivableId, language, role), { delay: 900 })
    : http<DraftMessage>('POST', `${CG}/actions/${actionId}/regenerate-draft`, { receivableId, language }, { timeoutMs: 60_000 });

export const getReceivables = () => (USE_MOCK ? mock(engine.getReceivables) : http<Receivable[]>('GET', '/api/receivables'));
export const getBills = () => (USE_MOCK ? mock(engine.getBills) : http<Bill[]>('GET', '/api/bills'));
export const getPurchaseOrders = () => (USE_MOCK ? mock(engine.getPurchaseOrders) : http<PurchaseOrder[]>('GET', '/api/purchase-orders'));
export const getAudit = () => (USE_MOCK ? mock(engine.getAudit) : http<AuditEvent[]>('GET', '/api/audit'));
export const getSettings = () => (USE_MOCK ? mock(engine.getSettings) : http<Settings>('GET', '/api/settings'));
export const updateSettings = (next: Settings) =>
  USE_MOCK ? mock(() => engine.updateSettings(role, next), { mutates: true }) : http<Settings>('PUT', '/api/settings', next, { mutates: true });

export const simulatePayments = () =>
  USE_MOCK ? mock(engine.simulatePayments, { mutates: true }) : http<void>('POST', '/api/demo/simulate-payments', undefined, { mutates: true });
export const simulateAiDown = () =>
  USE_MOCK ? mock(engine.simulateAiDown, { mutates: true }) : http<void>('POST', '/api/demo/simulate-ai-down', undefined, { mutates: true });
export const resetDemo = () =>
  USE_MOCK
    ? mock(() => { engine.reset(); touched = false; }, { mutates: true, touches: false })
    : http<void>('POST', '/api/demo/reset', undefined, { mutates: true });
