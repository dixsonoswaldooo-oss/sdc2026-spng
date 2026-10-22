// Fake backend for mock mode. It imitates what T1's API does, and it is the only place
// in the frontend allowed to compute money (CLAUDE.md §5). It runs on a Scenario: the built-in Kopi Kawan data,
// or whatever the Google Sheet says (src/mocks/sheet.ts).
import { ApiError } from '../api/errors.ts';
import type {
  Action, ActionType, AuditEvent, BasedOn, Bill, Breakdown, CashGuardSummary, DraftMessage, ISODate, Language,
  Money, ProjectionResult, PurchaseOrder, Receivable, Role, Settings, Status, Workspace,
} from '../api/types.ts';
import { formatMoney } from '../lib/format.ts';
import * as text from './aiText.ts';
import { AI_MODEL, DEFAULT_SCENARIO, type Scenario } from './fixtures.ts';

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
  draftVersion: Record<string, number>;
  nextEventId: number;
}

type FlowKind = 'sales' | 'receivables' | 'bills' | 'purchases' | 'payroll';
interface Flow { date: ISODate; amount: Money; kind: FlowKind }

const DAY_MS = 86_400_000;
const STATUS_WORDS: Record<Status, string> = { SAFE: 'Safe', AT_RISK: 'At risk', SHORTFALL: 'Shortfall' };
const OPEN: Action['status'][] = ['PROPOSED', 'PENDING_APPROVAL'];

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(items: T[], value: (item: T) => number) => round2(items.reduce((t, i) => t + value(i), 0));
const addDays = (iso: ISODate, n: number) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: ISODate, to: ISODate) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const isChased = (r: Receivable) => r.reminderStatus === 'SENT' || r.reminderStatus === 'REPLIED';

let scenario: Scenario = DEFAULT_SCENARIO;
const today = () => scenario.today;
const isOverdue = (r: Receivable) => r.dueDate < today();
let state = initialState();

// ---------- cash maths ----------

/** This month's payday, or next month's if it has already passed. */
function payday(s: State): ISODate {
  const [year, month] = today().split('-').map(Number);
  const day = s.settings.paydayDayOfMonth;
  const thisMonth = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return thisMonth >= today() ? thisMonth : new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/**
 * Every expected money movement from tomorrow to payday + 7 days.
 * Business rules: invoices not yet overdue count in full ("likely paid", brief §4); overdue invoices count only
 * after a reminder is sent, weighted by pay likelihood, arriving 2 days later. Bills and orders leave on their due date.
 */
function flows(s: State): Flow[] {
  const tomorrow = addDays(today(), 1);
  const end = addDays(payday(s), 7);
  const on = (date: ISODate) => (date < tomorrow ? tomorrow : date);
  const out: Flow[] = [];
  for (let d = tomorrow; d <= end; d = addDays(d, 1)) out.push({ date: d, amount: scenario.posDailyAverage, kind: 'sales' });
  for (const r of s.receivables) {
    if (!isOverdue(r)) out.push({ date: on(r.dueDate), amount: r.amount, kind: 'receivables' });
    else if (isChased(r)) out.push({ date: addDays(today(), 2), amount: round2(r.amount * r.likelihood), kind: 'receivables' });
  }
  for (const b of s.bills) out.push({ date: on(b.dueDate), amount: -b.amount, kind: 'bills' });
  for (const p of s.purchaseOrders) out.push({ date: on(p.dueDate), amount: -p.amount, kind: 'purchases' });
  out.push({ date: payday(s), amount: -scenario.payroll.total, kind: 'payroll' });
  return out;
}

function breakdown(s: State): Breakdown {
  const untilPayday = flows(s).filter((f) => f.date <= payday(s));
  const total = (kind: FlowKind) => Math.abs(sum(untilPayday.filter((f) => f.kind === kind), (f) => f.amount));
  const [expectedSales, expectedReceivables, billsDue, purchasesDue] = [total('sales'), total('receivables'), total('bills'), total('purchases')];
  const balanceBeforePayroll = round2(s.balance + expectedSales + expectedReceivables - billsDue - purchasesDue);
  return { currentBalance: s.balance, expectedSales, expectedReceivables, billsDue, purchasesDue, balanceBeforePayroll, projectedAfterPayroll: round2(balanceBeforePayroll - scenario.payroll.total) };
}

/** End-of-day balance for each day from today to payday + 7. */
function dailyBalances(s: State): { date: ISODate; balance: Money }[] {
  const all = flows(s);
  const points = [];
  let balance = s.balance;
  for (let d = today(); d <= addDays(payday(s), 7); d = addDays(d, 1)) {
    balance += sum(all.filter((f) => f.date === d), (f) => f.amount);
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
  if (a.type === 'CHASE_RECEIVABLE') s.receivables = s.receivables.map((r) => (a.relatedIds.includes(r.id) ? { ...r, reminderStatus: 'SENT' as const } : r));
  if (a.type === 'RESCHEDULE_BILL') s.bills = s.bills.map((b) => (a.relatedIds.includes(b.id) && b.shiftableTo ? { ...b, dueDate: b.shiftableTo } : b));
  if (a.type === 'HOLD_PURCHASE') s.purchaseOrders = s.purchaseOrders.map((p) => (a.relatedIds.includes(p.id) && p.suggestedDate ? { ...p, dueDate: p.suggestedDate } : p));
}

/** Money impact and wording from the current data, so both stay right after payments or sheet edits. */
function withImpact(s: State, a: Action): Action {
  if (!OPEN.includes(a.status)) return a; // decided actions keep what the person saw when deciding
  const pick = <T extends { id: string }>(items: T[]) => items.filter((i) => a.relatedIds.includes(i.id));
  if (a.type === 'CHASE_RECEIVABLE') {
    const invoices = pick(s.receivables);
    const [potential, expected] = [sum(invoices, (r) => r.amount), sum(invoices, (r) => round2(r.amount * r.likelihood))];
    return { ...a, ...text.chaseText(invoices, potential, expected), potentialImpact: potential, expectedImpact: expected };
  }
  if (a.type === 'RESCHEDULE_BILL') {
    const bills = pick(s.bills);
    const amount = sum(bills, (b) => b.amount);
    return { ...a, ...text.rescheduleText(bills, amount), potentialImpact: amount, expectedImpact: amount };
  }
  const orders = pick(s.purchaseOrders);
  const amount = sum(orders, (p) => p.amount);
  return { ...a, ...text.holdText(orders, amount), potentialImpact: amount, expectedImpact: amount };
}

/** The fixed menu of action types, ranked by how much cash each brings back before payday. */
function buildActions(s: State): Action[] {
  const pay = payday(s);
  const related: Record<ActionType, string[]> = {
    CHASE_RECEIVABLE: s.receivables.filter((r) => isOverdue(r) && !isChased(r)).map((r) => r.id),
    RESCHEDULE_BILL: s.bills.filter((b) => b.shiftable && b.shiftableTo && b.dueDate <= pay && b.shiftableTo > b.dueDate).map((b) => b.id),
    HOLD_PURCHASE: s.purchaseOrders.filter((p) => !p.urgent && p.dueDate <= pay && p.suggestedDate && p.suggestedDate > pay).map((p) => p.id),
  };
  return (Object.keys(related) as ActionType[])
    .filter((type) => related[type].length > 0)
    .map((type): Action => withImpact(s, {
      id: '', rank: 0, type, title: '', reason: '', confidence: 'HIGH', potentialImpact: 0, expectedImpact: 0, status: 'PROPOSED',
      relatedIds: related[type],
      drafts: type === 'CHASE_RECEIVABLE' ? related[type].map((rid) => draftFor(s, rid, s.settings.defaultLanguage, 0)) : undefined,
    }))
    .sort((x, y) => y.expectedImpact - x.expectedImpact)
    .map((a, i) => ({ ...a, id: `ACT-${i + 1}`, rank: i + 1 }));
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

// ---------- AI text (sample wording stands in for SEA-LION; see aiText.ts) ----------

function draftFor(s: State, receivableId: string, language: Language, version: number): DraftMessage {
  const r = s.receivables.find((x) => x.id === receivableId);
  if (!r) throw new ApiError(404, 'Invoice not found.');
  const channel = scenario.channels[receivableId] ?? 'EMAIL';
  const company = scenario.workspace.shortName;
  if (s.aiDown) return { receivableId, language, channel, body: text.fallbackDraft(r, language, company), isFallback: true };
  const options = [...(scenario.drafts[receivableId]?.[language] ?? []), ...text.templateDrafts(r, language, scenario.workspace.users.FINANCE_ADMIN.name, company)];
  return { receivableId, language, channel, body: options[version % options.length], isFallback: false };
}

function explanationFacts(s: State): text.ExplanationFacts {
  const b = breakdown(s);
  const buffer = s.settings.safetyBuffer;
  const unchased = s.receivables.filter((r) => isOverdue(r) && !isChased(r));
  const open = visibleActions(s).filter((a) => OPEN.includes(a.status));
  let withAllActions: text.ExplanationFacts['withAllActions'];
  if (open.length > 0) {
    const whatIf = structuredClone(s);
    open.forEach((a) => applyEffect(whatIf, a));
    const projected = breakdown(whatIf).projectedAfterPayroll;
    withAllActions = { projectedAfterPayroll: projected, status: statusOf(projected, buffer) };
  }
  return {
    payrollTotal: scenario.payroll.total, payday: payday(s), balanceBeforePayroll: b.balanceBeforePayroll,
    projectedAfterPayroll: b.projectedAfterPayroll, status: statusOf(b.projectedAfterPayroll, buffer), safetyBuffer: buffer,
    gapToBuffer: gapToBuffer(b.projectedAfterPayroll, buffer), overdueUnchased: sum(unchased, (r) => r.amount),
    overdueUnchasedCount: unchased.length, billsDue: b.billsDue, withAllActions,
  };
}

/** After the numbers change, the agent rewrites its explanation so it never contradicts the status. */
function refreshExplanation(): void {
  state.explanation = text.explanation(explanationFacts(state));
  state.aiGeneratedAt = now();
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

/** Demo date with the real Malaysia clock time, never earlier than the daily check. */
function now(): string {
  const clock = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(11, 19);
  const checked = scenario.checkedAt.slice(11, 19);
  return `${today()}T${clock <= checked ? checked.slice(0, 5) + ':59' : clock}+08:00`;
}

function log(s: State, role: AuditEvent['role'], kind: string, summary: string, details?: Record<string, unknown>, at = now()): void {
  const actor = role === 'AGENT' ? 'Cash Guard agent' : role === 'SYSTEM' ? 'System' : scenario.workspace.users[role].name;
  s.audit.push({ id: `EVT-${s.nextEventId++}`, at, actor, role, kind, summary, details });
}

function logRun(s: State, at: (step: number) => string): void {
  const b = breakdown(s);
  const status = statusOf(b.projectedAfterPayroll, s.settings.safetyBuffer);
  const { total, headcount } = scenario.payroll;
  log(s, 'AGENT', 'AGENT_RUN', `Cash check started (${daysBetween(today(), payday(s))} days to payday)`, undefined, at(0));
  log(s, 'AGENT', 'DATA_READ', `Read payroll from Orbyte People: ${headcount} staff, ${formatMoney(total)}`, { Source: 'Orbyte People' }, at(1));
  log(s, 'AGENT', 'DATA_READ', `Read bank balance, ${s.receivables.length} invoices, ${s.bills.length} bills and POS sales from Orbyte Connect`, { Source: 'Orbyte Connect' }, at(2));
  log(s, 'SYSTEM', 'PROJECTION', `Projected balance after payroll: ${formatMoney(b.projectedAfterPayroll)} (${STATUS_WORDS[status]})`, {
    'Bank balance': formatMoney(b.currentBalance),
    'Sales to payday': formatMoney(b.expectedSales),
    'Invoices in': formatMoney(b.expectedReceivables),
    'Bills out': formatMoney(b.billsDue),
    'Purchases out': formatMoney(b.purchasesDue),
    'Payroll': formatMoney(total),
    'Computed by': 'Rules in code, not by AI',
  }, at(3));
  log(s, 'AGENT', 'AI_OUTPUT', s.aiDown ? 'AI unavailable: rules-based explanation and template drafts used' : 'SEA-LION explained the result and ranked the actions', { Model: s.aiDown ? 'none' : AI_MODEL, Fallback: s.aiDown ? 'yes' : 'no' }, at(4));
}

function initialState(): State {
  const sc = structuredClone(scenario);
  const s: State = {
    settings: sc.settings, balance: sc.bankBalance, receivables: sc.receivables, bills: sc.bills, purchaseOrders: sc.purchaseOrders,
    actions: [], audit: [], aiDown: false, explanation: '', aiGeneratedAt: sc.checkedAt, lastCheckedAt: sc.checkedAt,
    draftVersion: {}, nextEventId: 1,
  };
  s.actions = buildActions(s);
  s.explanation = sc.aiExplanation?.trim() || text.explanation(explanationFacts(s));
  const at = (step: number) => `${sc.checkedAt.slice(0, 17)}${String(step * 10).padStart(2, '0')}${sc.checkedAt.slice(19)}`;
  logRun(s, at);
  return s;
}

function requireRole(role: Role, allowed: Role, message: string): void {
  if (role !== allowed) throw new ApiError(403, message);
}

/** Saves what the person saw (title, reason, amounts) before an action is decided. */
function freeze(action: Action): void {
  Object.assign(action, withImpact(state, action));
}

// ---------- the "endpoints" ----------

export const getWorkspace = (): Workspace => scenario.workspace;
export const getScenario = (): Scenario => scenario;

export function getSummary(): CashGuardSummary {
  const b = breakdown(state);
  const buffer = state.settings.safetyBuffer;
  const pay = payday(state);
  const facts = explanationFacts(state);
  return {
    companyName: scenario.workspace.companyName, today: today(), payday: pay, daysToPayday: daysBetween(today(), pay),
    payrollTotal: scenario.payroll.total, headcount: scenario.payroll.headcount, breakdown: b, safetyBuffer: buffer,
    gapToBuffer: gapToBuffer(b.projectedAfterPayroll, buffer), status: statusOf(b.projectedAfterPayroll, buffer), lastCheckedAt: state.lastCheckedAt,
    ai: {
      explanation: state.aiDown ? text.fallbackExplanation(facts, sum(state.receivables.filter(isOverdue), (r) => r.amount)) : state.explanation,
      basedOn: basedOn(state), model: state.aiDown ? 'Rules-based fallback' : AI_MODEL, generatedAt: state.aiGeneratedAt, isFallback: state.aiDown,
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
  refreshExplanation();
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
  freeze(action);
  action.status = 'APPROVED';
  log(state, role, 'ACTION_APPROVED', `Approved "${action.title}"`, { Action: id, Items: action.relatedIds });
  applyEffect(state, action);
  if (action.type === 'CHASE_RECEIVABLE') {
    const at = now();
    state.receivables = state.receivables.map((r) => (action.relatedIds.includes(r.id) ? { ...r, lastContactAt: at } : r));
  }
  action.status = 'EXECUTED';
  refreshExplanation();
  const n = action.relatedIds.length;
  const done: Record<ActionType, string> = {
    CHASE_RECEIVABLE: `${n} reminder${n === 1 ? '' : 's'} queued for sending (demo: nothing is actually sent)`,
    RESCHEDULE_BILL: `Bill ${action.relatedIds.join(', ')} moved to its later due date in Orbyte Connect`,
    HOLD_PURCHASE: `Purchase order ${action.relatedIds.join(', ')} rescheduled to after payday`,
  };
  log(state, 'SYSTEM', 'ACTION_EXECUTED', done[action.type], { Action: id });
  return action;
}

export function rejectAction(id: string, role: Role, reason: string): Action {
  requireRole(role, 'OWNER', 'Only the Owner can reject actions.');
  if (!reason.trim()) throw new ApiError(400, 'Please give a short reason.');
  const action = findOpenAction(id);
  freeze(action);
  action.status = 'REJECTED';
  log(state, role, 'ACTION_REJECTED', `Rejected "${action.title}"`, { Action: id, Reason: reason.trim() });
  return action;
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
  ...r, daysOverdue: Math.max(0, daysBetween(r.dueDate, today())), countedInProjection: !isOverdue(r) || isChased(r),
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
  const total = sum(paid, (r) => r.amount);
  state.balance = round2(state.balance + total);
  state.receivables = state.receivables.filter((r) => !isOverdue(r));
  refreshExplanation();
  log(state, 'SYSTEM', 'DEMO_SIMULATION', `Demo: ${paid.length} overdue invoices paid in full (${formatMoney(total)})`, { 'Paid invoices': paid.map((r) => r.id) });
}

export function simulateAiDown(): void {
  state.aiDown = true;
  state.actions.filter((a) => a.type === 'CHASE_RECEIVABLE' && OPEN.includes(a.status)).forEach((a) => {
    const unpaid = a.relatedIds.filter((rid) => state.receivables.some((r) => r.id === rid)); // paid invoices are gone
    a.drafts = unpaid.map((rid) => draftFor(state, rid, state.settings.defaultLanguage, 0));
  });
  log(state, 'SYSTEM', 'DEMO_SIMULATION', 'Demo: AI marked unavailable, rules-based fallback in use');
}

export function reset(): void {
  state = initialState();
}

/** Switches the demo to another set of data (e.g. from the Google Sheet) and starts it fresh. */
export function loadScenario(next: Scenario): void {
  scenario = next;
  state = initialState();
}

/** Lets the client keep the demo across a page refresh (saved per browser tab). */
export const exportState = (): string => JSON.stringify({ scenario, state });

/** Restores a saved demo only if it was made from the same data; returns false when the data has changed since. */
export function importState(saved: string): boolean {
  const parsed = JSON.parse(saved) as { scenario: Scenario; state: State };
  if (JSON.stringify(parsed.scenario) !== JSON.stringify(scenario)) return false;
  state = parsed.state;
  return true;
}

