// Fake backend for mock mode. It imitates what T1's API does, and it is the only place
// in the frontend allowed to compute money (CLAUDE.md §5). State lives in memory: a page refresh resets the demo.
import { ApiError } from '../api/errors.ts';
import type {
  Action, ActionType, AuditEvent, BasedOn, Bill, Breakdown, CashGuardSummary, DraftMessage, ISODate, Language,
  Money, ProjectionResult, PurchaseOrder, Receivable, Role, Settings, Status,
} from '../api/types.ts';
import { formatDate, formatMoney } from '../lib/format.ts';
import * as F from './fixtures.ts';

interface State {
  settings: Settings;
  balance: Money;
  receivables: Receivable[];
  bills: Bill[];
  purchaseOrders: PurchaseOrder[];
  actions: Action[];
  audit: AuditEvent[];
  aiDown: boolean;
  explanation: string;
  aiGeneratedAt: string;
  lastCheckedAt: string;
  changedSinceStart: boolean; // once true, the AI text is no longer the fixture
  draftVersion: Record<string, number>;
  nextEventId: number;
}

type FlowKind = 'sales' | 'receivables' | 'bills' | 'purchases' | 'payroll';
interface Flow { date: ISODate; amount: Money; kind: FlowKind }

const DAY_MS = 86_400_000;
const STATUS_WORDS: Record<Status, string> = { SAFE: 'Safe', AT_RISK: 'At risk', SHORTFALL: 'Shortfall' };
const OPEN: Action['status'][] = ['PROPOSED', 'PENDING_APPROVAL'];
const TODAY = F.DEMO_TODAY;

const round2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (iso: ISODate, n: number) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: ISODate, to: ISODate) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const isOverdue = (r: Receivable) => r.dueDate < TODAY;
const isChased = (r: Receivable) => r.reminderStatus === 'SENT' || r.reminderStatus === 'REPLIED';

let state = initialState();

// ---------- cash maths ----------

/** This month's payday, or next month's if it has already passed. */
function payday(s: State): ISODate {
  const [year, month] = TODAY.split('-').map(Number);
  const thisMonth = new Date(Date.UTC(year, month - 1, s.settings.paydayDayOfMonth)).toISOString().slice(0, 10);
  return thisMonth >= TODAY ? thisMonth : new Date(Date.UTC(year, month, s.settings.paydayDayOfMonth)).toISOString().slice(0, 10);
}

/**
 * Every expected money movement from tomorrow to payday + 7 days.
 * Business rules: invoices not yet overdue count in full ("likely paid", brief §4); overdue invoices count only
 * after a reminder is sent, weighted by pay likelihood, arriving 2 days later. Bills and orders leave on their due date.
 */
function flows(s: State): Flow[] {
  const tomorrow = addDays(TODAY, 1);
  const end = addDays(payday(s), 7);
  const on = (date: ISODate) => (date < tomorrow ? tomorrow : date);
  const out: Flow[] = [];
  for (let d = tomorrow; d <= end; d = addDays(d, 1)) out.push({ date: d, amount: F.POS_DAILY_AVERAGE, kind: 'sales' });
  for (const r of s.receivables) {
    if (!isOverdue(r)) out.push({ date: on(r.dueDate), amount: r.amount, kind: 'receivables' });
    else if (isChased(r)) out.push({ date: addDays(TODAY, 2), amount: round2(r.amount * r.likelihood), kind: 'receivables' });
  }
  for (const b of s.bills) out.push({ date: on(b.dueDate), amount: -b.amount, kind: 'bills' });
  for (const p of s.purchaseOrders) out.push({ date: on(p.dueDate), amount: -p.amount, kind: 'purchases' });
  out.push({ date: payday(s), amount: -F.PAYROLL.total, kind: 'payroll' });
  return out;
}

function breakdown(s: State): Breakdown {
  const untilPayday = flows(s).filter((f) => f.date <= payday(s));
  const total = (kind: FlowKind) => Math.abs(round2(untilPayday.filter((f) => f.kind === kind).reduce((t, f) => t + f.amount, 0)));
  const [expectedSales, expectedReceivables, billsDue, purchasesDue] = [total('sales'), total('receivables'), total('bills'), total('purchases')];
  const balanceBeforePayroll = round2(s.balance + expectedSales + expectedReceivables - billsDue - purchasesDue);
  return { currentBalance: s.balance, expectedSales, expectedReceivables, billsDue, purchasesDue, balanceBeforePayroll, projectedAfterPayroll: round2(balanceBeforePayroll - F.PAYROLL.total) };
}

/** End-of-day balance for each day from today to payday + 7. */
function dailyBalances(s: State): { date: ISODate; balance: Money }[] {
  const all = flows(s);
  const points = [];
  let balance = s.balance;
  for (let d = TODAY; d <= addDays(payday(s), 7); d = addDays(d, 1)) {
    balance += all.filter((f) => f.date === d).reduce((t, f) => t + f.amount, 0);
    points.push({ date: d, balance: round2(balance) });
  }
  return points;
}

function statusOf(projected: Money, buffer: Money): Status {
  if (projected >= buffer) return 'SAFE';
  return projected >= 0 ? 'AT_RISK' : 'SHORTFALL';
}

const gapToBuffer = (projected: Money, buffer: Money) => round2(Math.max(0, buffer - projected));

// ---------- actions ----------

/** What an approved action changes in the data. Used for real approvals and for what-if copies. */
function applyEffect(s: State, a: Action): void {
  if (a.type === 'CHASE_RECEIVABLE') s.receivables = s.receivables.map((r) => (a.relatedIds.includes(r.id) ? { ...r, reminderStatus: 'SENT' } : r));
  if (a.type === 'RESCHEDULE_BILL') s.bills = s.bills.map((b) => (a.relatedIds.includes(b.id) && b.shiftableTo ? { ...b, dueDate: b.shiftableTo } : b));
  if (a.type === 'HOLD_PURCHASE') s.purchaseOrders = s.purchaseOrders.map((p) => (a.relatedIds.includes(p.id) && p.suggestedDate ? { ...p, dueDate: p.suggestedDate } : p));
}

function buildActions(s: State): Action[] {
  const pay = payday(s);
  const related: Record<ActionType, string[]> = {
    CHASE_RECEIVABLE: s.receivables.filter((r) => isOverdue(r) && !isChased(r)).map((r) => r.id),
    RESCHEDULE_BILL: s.bills.filter((b) => b.shiftable && b.dueDate <= pay).map((b) => b.id),
    HOLD_PURCHASE: s.purchaseOrders.filter((p) => !p.urgent && p.dueDate <= pay).map((p) => p.id),
  };
  return (Object.keys(F.ACTION_TEXT) as ActionType[])
    .filter((type) => related[type].length > 0)
    .map((type) => ({
      id: `ACT-${F.ACTION_TEXT[type].rank}`, type, ...F.ACTION_TEXT[type], potentialImpact: 0, expectedImpact: 0, status: 'PROPOSED',
      relatedIds: related[type],
      drafts: type === 'CHASE_RECEIVABLE' ? related[type].map((id) => draftFor(s, id, s.settings.defaultLanguage, 0)) : undefined,
    }));
}

/** Fills in the money impact from the current data (so it stays right after payments or edits). */
function withImpact(s: State, a: Action): Action {
  const pick = <T extends { id: string; amount: Money }>(items: T[]) => items.filter((i) => a.relatedIds.includes(i.id));
  if (a.type === 'CHASE_RECEIVABLE') {
    const invoices = pick(s.receivables);
    const expected = round2(invoices.reduce((t, r) => t + round2(r.amount * r.likelihood), 0));
    const title = `Chase ${invoices.length} overdue invoice${invoices.length === 1 ? '' : 's'}`;
    return { ...a, title, potentialImpact: round2(invoices.reduce((t, r) => t + r.amount, 0)), expectedImpact: expected };
  }
  const items: { id: string; amount: Money }[] = a.type === 'RESCHEDULE_BILL' ? s.bills : s.purchaseOrders;
  const amount = round2(pick(items).reduce((t, i) => t + i.amount, 0));
  return { ...a, potentialImpact: amount, expectedImpact: amount };
}

function visibleActions(s: State): Action[] {
  return s.actions
    .filter((a) => s.settings.enabledActions.includes(a.type))
    .map((a) => withImpact(s, a))
    .filter((a) => !(OPEN.includes(a.status) && a.potentialImpact === 0)) // e.g. every overdue invoice already paid
    .sort((x, y) => x.rank - y.rank);
}

function findOpenAction(id: string): Action {
  const action = state.actions.find((a) => a.id === id);
  if (!action) throw new ApiError(404, 'This action no longer exists.');
  if (!OPEN.includes(action.status)) throw new ApiError(409, 'This action has already been decided.');
  return action;
}

// ---------- AI text (fixtures stand in for SEA-LION) ----------

function draftFor(s: State, receivableId: string, language: Language, version: number): DraftMessage {
  const r = s.receivables.find((x) => x.id === receivableId);
  if (!r) throw new ApiError(404, 'Invoice not found.');
  const channel = F.CHANNELS[receivableId] ?? 'EMAIL';
  const options = F.DRAFTS[receivableId]?.[language];
  if (s.aiDown || !options) {
    const [amount, due] = [formatMoney(r.amount), formatDate(r.dueDate)];
    const body = language === 'EN'
      ? `Hello ${r.contactName}, this is a reminder that invoice ${r.id} (${amount}, due ${due}) is unpaid. Please let us know the expected payment date. Thank you. — Kopi Kawan Trading`
      : `Salam ${r.contactName}, ini peringatan bahawa invois ${r.id} (${amount}, tarikh akhir ${due}) belum dibayar. Sila maklumkan tarikh jangkaan bayaran. Terima kasih. — Kopi Kawan Trading`;
    return { receivableId, language, channel, body, isFallback: true };
  }
  return { receivableId, language, channel, body: options[version % options.length], isFallback: false };
}

function narrate(s: State): string {
  const b = breakdown(s);
  const buffer = s.settings.safetyBuffer;
  const status = statusOf(b.projectedAfterPayroll, buffer);
  const payroll = `Payroll of ${formatMoney(F.PAYROLL.total)} is due on ${formatDate(payday(s))}`;
  const overdue = s.receivables.filter((r) => isOverdue(r) && !isChased(r));
  const lever = overdue.length ? ` The ${overdue.length} unchased overdue invoices (${formatMoney(overdue.reduce((t, r) => t + r.amount, 0))}) are still the biggest lever.` : '';
  const body = status === 'SAFE'
    ? `${payroll} and is covered: your projected balance after payroll is ${formatMoney(b.projectedAfterPayroll)}, above your ${formatMoney(buffer)} safety buffer. No further action is needed.`
    : `${payroll}. With the changes so far, your projected balance after payroll is ${formatMoney(b.projectedAfterPayroll)}, ${formatMoney(gapToBuffer(b.projectedAfterPayroll, buffer))} short of your ${formatMoney(buffer)} safety buffer.${lever}`;
  return `${body} No recommendation affects staff salaries.`;
}

/** After the numbers change, the agent rewrites its explanation so it never contradicts the status. */
function refreshExplanation(): void {
  state.changedSinceStart = true;
  state.explanation = narrate(state);
  state.aiGeneratedAt = now();
}

function fallbackExplanation(s: State): string {
  const b = breakdown(s);
  const overdue = s.receivables.filter(isOverdue).reduce((t, r) => t + r.amount, 0);
  return `Projected balance after payroll on ${formatDate(payday(s))} is ${formatMoney(b.projectedAfterPayroll)} against a safety buffer of ${formatMoney(s.settings.safetyBuffer)}. Overdue invoices total ${formatMoney(overdue)}. Bills due before payday total ${formatMoney(b.billsDue)}. Actions are ranked by expected cash impact. This text is rules-based because the AI is unavailable.`;
}

function basedOn(s: State): BasedOn[] {
  const overdue = s.receivables.filter(isOverdue).length;
  const bills = s.bills.filter((b) => b.dueDate <= payday(s)).length;
  const items: BasedOn[] = [{ label: 'Payroll', source: 'PAYROLL' }];
  if (overdue) items.push({ label: `${overdue} overdue invoice${overdue === 1 ? '' : 's'}`, source: 'RECEIVABLES' });
  if (bills) items.push({ label: `${bills} bill${bills === 1 ? '' : 's'}`, source: 'BILLS' });
  return items;
}

// ---------- activity log ----------

/** Demo date with the real Malaysia clock time, so timestamps fit the scenario. */
function now(): string {
  const clock = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(11, 19);
  return `${TODAY}T${clock < '08:01:00' ? '08:01:00' : clock}+08:00`; // never earlier than the 08:00 daily check
}

function log(s: State, role: AuditEvent['role'], kind: string, summary: string, details?: Record<string, unknown>, at = now()): void {
  const actor = role === 'AGENT' ? 'Cash Guard agent' : role === 'SYSTEM' ? 'System' : F.WORKSPACE.users[role].name;
  s.audit.push({ id: `EVT-${s.nextEventId++}`, at, actor, role, kind, summary, details });
}

function logRun(s: State, at: (step: number) => string): void {
  const b = breakdown(s);
  const status = statusOf(b.projectedAfterPayroll, s.settings.safetyBuffer);
  log(s, 'AGENT', 'AGENT_RUN', `Cash check started (${daysBetween(TODAY, payday(s))} days to payday)`, undefined, at(0));
  log(s, 'AGENT', 'DATA_READ', `Read payroll from Orbyte People: ${F.PAYROLL.headcount} staff, ${formatMoney(F.PAYROLL.total)}`, { Source: 'Orbyte People' }, at(1));
  log(s, 'AGENT', 'DATA_READ', `Read bank balance, ${s.receivables.length} invoices, ${s.bills.length} bills and POS sales from Orbyte Connect`, { Source: 'Orbyte Connect' }, at(2));
  log(s, 'SYSTEM', 'PROJECTION', `Projected balance after payroll: ${formatMoney(b.projectedAfterPayroll)} (${STATUS_WORDS[status]})`, {
    'Bank balance': formatMoney(b.currentBalance),
    'Sales to payday': formatMoney(b.expectedSales),
    'Invoices in': formatMoney(b.expectedReceivables),
    'Bills out': formatMoney(b.billsDue),
    'Purchases out': formatMoney(b.purchasesDue),
    'Payroll': formatMoney(F.PAYROLL.total),
    'Computed by': 'Rules in code, not by AI',
  }, at(3));
  log(s, 'AGENT', 'AI_OUTPUT', s.aiDown ? 'AI unavailable: rules-based explanation and template drafts used' : 'SEA-LION explained the result and ranked the actions', { Model: s.aiDown ? 'none' : F.AI_MODEL, Fallback: s.aiDown ? 'yes' : 'no' }, at(4));
}

function initialState(): State {
  const s: State = {
    settings: structuredClone(F.SETTINGS), balance: F.BANK_BALANCE, receivables: structuredClone(F.RECEIVABLES),
    bills: structuredClone(F.BILLS), purchaseOrders: structuredClone(F.PURCHASE_ORDERS), actions: [], audit: [],
    aiDown: false, explanation: F.AI_EXPLANATION, aiGeneratedAt: F.CHECKED_AT, lastCheckedAt: F.CHECKED_AT,
    changedSinceStart: false, draftVersion: {}, nextEventId: 1,
  };
  s.actions = buildActions(s);
  logRun(s, (step) => F.CHECKED_AT.replace(':00+', `:${String(step * 10).padStart(2, '0')}+`));
  return s;
}

function requireRole(role: Role, allowed: Role, message: string): void {
  if (role !== allowed) throw new ApiError(403, message);
}

// ---------- the "endpoints" ----------

export function getSummary(): CashGuardSummary {
  const b = breakdown(state);
  const buffer = state.settings.safetyBuffer;
  const pay = payday(state);
  return {
    companyName: F.WORKSPACE.companyName, today: TODAY, payday: pay, daysToPayday: daysBetween(TODAY, pay),
    payrollTotal: F.PAYROLL.total, headcount: F.PAYROLL.headcount, breakdown: b, safetyBuffer: buffer,
    gapToBuffer: gapToBuffer(b.projectedAfterPayroll, buffer), status: statusOf(b.projectedAfterPayroll, buffer), lastCheckedAt: state.lastCheckedAt,
    ai: {
      explanation: state.aiDown ? fallbackExplanation(state) : state.explanation, basedOn: basedOn(state),
      model: state.aiDown ? 'Rules-based fallback' : F.AI_MODEL, generatedAt: state.aiGeneratedAt, isFallback: state.aiDown,
    },
  };
}

/** Current line plus a what-if line with the chosen open actions applied to a copy of the data. */
export function getProjection(actionIds: string[]): ProjectionResult {
  const whatIf = structuredClone(state);
  visibleActions(state).filter((a) => actionIds.includes(a.id) && OPEN.includes(a.status)).forEach((a) => applyEffect(whatIf, a));
  const [current, withActions] = [dailyBalances(state), dailyBalances(whatIf)];
  const projected = breakdown(whatIf).projectedAfterPayroll;
  const buffer = state.settings.safetyBuffer;
  return {
    points: current.map((p, i) => ({ date: p.date, current: p.balance, withActions: withActions[i].balance })),
    withActions: { projectedAfterPayroll: projected, gapToBuffer: gapToBuffer(projected, buffer), status: statusOf(projected, buffer) },
  };
}

export function runCheck(): { runId: string } {
  state.lastCheckedAt = now();
  state.aiGeneratedAt = state.lastCheckedAt;
  if (state.changedSinceStart) state.explanation = narrate(state);
  logRun(state, now);
  return { runId: `RUN-${state.nextEventId}` };
}

export const getActions = (): Action[] => visibleActions(state);

export function submitAction(id: string, role: Role, drafts?: DraftMessage[]): Action {
  requireRole(role, 'FINANCE_ADMIN', 'Only a Finance Admin submits actions for approval.');
  const action = findOpenAction(id);
  if (action.status !== 'PROPOSED') throw new ApiError(409, 'This action is already waiting for approval.');
  if (drafts) action.drafts = drafts;
  action.status = 'PENDING_APPROVAL';
  log(state, role, 'ACTION_SUBMITTED', `Submitted "${withImpact(state, action).title}" for the Owner's approval`, { Action: id, 'Messages attached': drafts?.length ?? 0 });
  return withImpact(state, action);
}

export function approveAction(id: string, role: Role, drafts?: DraftMessage[]): Action {
  requireRole(role, 'OWNER', 'Only the Owner can approve actions.');
  const action = findOpenAction(id);
  if (action.type === 'CHASE_RECEIVABLE' && drafts) {
    const chosen = drafts.map((d) => d.receivableId).filter((rid) => action.relatedIds.includes(rid));
    if (chosen.length === 0) throw new ApiError(400, 'Choose at least one invoice to chase.');
    action.relatedIds = chosen;
    action.drafts = drafts.filter((d) => chosen.includes(d.receivableId));
  }
  const title = withImpact(state, action).title;
  action.status = 'APPROVED';
  log(state, role, 'ACTION_APPROVED', `Approved "${title}"`, { Action: id, Items: action.relatedIds });
  applyEffect(state, action);
  if (action.type === 'CHASE_RECEIVABLE') {
    const at = now();
    state.receivables = state.receivables.map((r) => (action.relatedIds.includes(r.id) ? { ...r, lastContactAt: at } : r));
  }
  action.status = 'EXECUTED';
  refreshExplanation();
  const done: Record<ActionType, string> = {
    CHASE_RECEIVABLE: `${action.relatedIds.length} reminder${action.relatedIds.length === 1 ? '' : 's'} queued for sending (demo: nothing is actually sent)`,
    RESCHEDULE_BILL: `Bill ${action.relatedIds.join(', ')} moved to its later due date in Orbyte Connect`,
    HOLD_PURCHASE: `Purchase order ${action.relatedIds.join(', ')} rescheduled to after payday`,
  };
  log(state, 'SYSTEM', 'ACTION_EXECUTED', done[action.type], { Action: id });
  return withImpact(state, action);
}

export function rejectAction(id: string, role: Role, reason: string): Action {
  requireRole(role, 'OWNER', 'Only the Owner can reject actions.');
  if (!reason.trim()) throw new ApiError(400, 'Please give a short reason.');
  const action = findOpenAction(id);
  action.status = 'REJECTED';
  log(state, role, 'ACTION_REJECTED', `Rejected "${withImpact(state, action).title}"`, { Action: id, Reason: reason.trim() });
  return withImpact(state, action);
}

export function regenerateDraft(receivableId: string, language: Language, role: Role): DraftMessage {
  const key = `${receivableId}:${language}`;
  const version = key in state.draftVersion ? state.draftVersion[key] + 1 : 0;
  state.draftVersion[key] = version;
  const draft = draftFor(state, receivableId, language, version);
  log(state, role, 'DRAFT_GENERATED', `${draft.isFallback ? 'Template' : 'AI'} ${language} reminder drafted for ${receivableId}`, { Fallback: draft.isFallback ? 'yes' : 'no' });
  return draft;
}

export const getReceivables = (): Receivable[] => state.receivables.map((r) => ({
  ...r, daysOverdue: Math.max(0, daysBetween(r.dueDate, TODAY)), countedInProjection: !isOverdue(r) || isChased(r),
}));
export const getBills = (): Bill[] => state.bills;
export const getPurchaseOrders = (): PurchaseOrder[] => state.purchaseOrders;
export const getAudit = (): AuditEvent[] => [...state.audit].reverse();
export const getSettings = (): Settings => state.settings;

export function updateSettings(role: Role, next: Settings): Settings {
  requireRole(role, 'OWNER', 'Only the Owner can change settings.');
  if (next.paydayDayOfMonth < 1 || next.paydayDayOfMonth > 28) throw new ApiError(400, 'Payday must be between day 1 and 28.');
  if (next.safetyBuffer < 0 || next.leadTimeDays < 1 || next.leadTimeDays > 30) throw new ApiError(400, 'Lead time must be 1 to 30 days and the buffer cannot be negative.');
  state.settings = { ...next };
  log(state, role, 'SETTINGS_CHANGED', 'Cash Guard settings updated', {
    'Payday': `day ${next.paydayDayOfMonth} of the month`,
    'Alert lead time': `${next.leadTimeDays} days`,
    'Safety buffer': formatMoney(next.safetyBuffer),
    'Message language': next.defaultLanguage,
    'Actions allowed': next.enabledActions.join(', '),
  });
  refreshExplanation();
  return state.settings;
}

export function simulatePayments(): void {
  const paid = state.receivables.filter(isOverdue);
  const total = round2(paid.reduce((t, r) => t + r.amount, 0));
  state.balance = round2(state.balance + total);
  state.receivables = state.receivables.filter((r) => !isOverdue(r));
  refreshExplanation();
  log(state, 'SYSTEM', 'DEMO_SIMULATION', `Demo: ${paid.length} overdue invoices paid in full (${formatMoney(total)})`, { 'Paid invoices': paid.map((r) => r.id) });
}

export function simulateAiDown(): void {
  state.aiDown = true;
  state.actions.filter((a) => a.type === 'CHASE_RECEIVABLE' && OPEN.includes(a.status))
    .forEach((a) => {
      const unpaid = a.relatedIds.filter((id) => state.receivables.some((r) => r.id === id)); // paid invoices are gone
      a.drafts = unpaid.map((id) => draftFor(state, id, state.settings.defaultLanguage, 0));
    });
  log(state, 'SYSTEM', 'DEMO_SIMULATION', 'Demo: AI marked unavailable, rules-based fallback in use');
}

export function reset(): void {
  state = initialState();
}

/** Lets the client keep the demo across a page refresh (saved per browser tab). */
export const exportState = (): string => JSON.stringify(state);
export function importState(saved: string): void {
  state = JSON.parse(saved) as State;
}
