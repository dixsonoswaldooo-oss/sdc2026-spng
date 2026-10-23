// Every change to the demo data, as pure functions: (data, input) → new data.
// After each change `reconcile` recalculates pay, logs net-pay changes and sends (simulated) WhatsApp messages.
import { money, monthName, toSen } from './format';
import { computePayroll, datesBetween, deductionMessage } from './payroll';
import { DEMO_MONTH, seedState } from './seed';
import type {
  ActivityEntry, ActivityKind, Employee, LeaveClassification, LeaveLabel, LeaveRequest, LeaveType, Month, Overtime,
  PaymentLine, PayrollBreakdown, PayrollConfig, WhatsAppMessage,
} from './types';

export interface Data extends ReturnType<typeof seedState> {
  whatsapp: WhatsAppMessage[];
  activity: ActivityEntry[];
  notified: Record<string, number>; // "E3|LATE:2026-10-14" → amount last sent by WhatsApp
  lastNet: Record<string, number>; // employee → take-home pay last calculated for the current month
  seq: number;
}

/** Who did it and when. `now` is passed in so tests are repeatable. */
export interface Ctx {
  actor: string;
  now: string;
}

export const LABEL_WORDS: Record<LeaveLabel, string> = { DITOLERANSI: 'Tolerated', DIPOTONG: 'Deducted' };

const nextId = (d: Data, prefix: string) => `${prefix}-${++d.seq}`;

function log(d: Data, ctx: Ctx, kind: ActivityKind, action: string, target: string, detail = '', actor = ctx.actor): void {
  d.activity.unshift({ id: nextId(d, 'LOG'), at: ctx.now, actor, kind, action, target, detail });
}

function sendWhatsApp(d: Data, ctx: Ctx, employee: Employee, kind: WhatsAppMessage['kind'], text: string): void {
  d.whatsapp.unshift({ id: nextId(d, 'WA'), employeeId: employee.id, to: employee.whatsapp, at: ctx.now, kind, text });
  log(d, ctx, 'WHATSAPP', kind === 'OVERTIME_OFFER' ? 'Sent overtime offer by WhatsApp' : 'Sent deduction alert by WhatsApp', employee.name, text, 'System');
}

export const isPaid = (d: Data, month: Month) => d.payments.some((p) => p.month === month);
const employee = (d: Data, id: string) => d.employees.find((e) => e.id === id)!;

/** Pay for one employee: the frozen snapshot if the month is paid, otherwise calculated live. */
export function payrollFor(d: Data, employeeId: string, month: Month): PayrollBreakdown | PaymentLine {
  const paid = d.payments.find((p) => p.month === month)?.lines.find((l) => l.employeeId === employeeId);
  if (paid) return paid;
  return computePayroll({
    employee: employee(d, employeeId), month, config: d.config,
    attendance: d.attendance.filter((a) => a.employeeId === employeeId),
    leaves: d.leaves.filter((l) => l.employeeId === employeeId),
    overtime: d.overtime.filter((o) => o.employeeId === employeeId),
  });
}

/** Recalculate the current month; log changed take-home pay; WhatsApp new, changed or removed deductions. */
export function reconcile(d: Data, ctx: Ctx): Data {
  if (isPaid(d, DEMO_MONTH)) return d; // a paid month is locked
  const label = monthName(DEMO_MONTH);
  for (const e of d.employees) {
    const p = payrollFor(d, e.id, DEMO_MONTH);
    const before = d.lastNet[e.id];
    if (before !== undefined && before !== p.netPay) {
      log(d, ctx, 'RECALC', 'Recalculated take-home pay', e.name, `${money(before)} → ${money(p.netPay)}`, 'System');
    }
    d.lastNet[e.id] = p.netPay;
    const current = new Set<string>();
    for (const ev of p.events) {
      const key = `${e.id}|${ev.key}`;
      current.add(key);
      const sent = d.notified[key];
      if (sent === ev.amount) continue;
      sendWhatsApp(d, ctx, e, sent === undefined ? 'DEDUCTION' : 'DEDUCTION_UPDATE', deductionMessage(e.name, label, ev, p.netPay, sent !== undefined));
      d.notified[key] = ev.amount;
    }
    for (const key of Object.keys(d.notified)) {
      if (!key.startsWith(`${e.id}|`) || current.has(key) || d.notified[key] === 0) continue;
      const [kind, day] = key.split('|')[1].split(':') as ['LATE' | 'ABSENT' | 'LEAVE', string];
      sendWhatsApp(d, ctx, e, 'DEDUCTION_UPDATE', deductionMessage(e.name, label, { key, date: day, kind, amount: 0, explanation: '' }, p.netPay, true));
      d.notified[key] = 0;
    }
  }
  return d;
}

/** Applies a change to a copy of the data, then reconciles. */
function change(data: Data, ctx: Ctx, edit: (d: Data) => void): Data {
  const d = structuredClone(data);
  edit(d);
  return reconcile(d, ctx);
}

export function freshData(ctx: Ctx): Data {
  const d: Data = { ...seedState(), whatsapp: [], activity: [], notified: {}, lastNet: {}, seq: 0 };
  log(d, ctx, 'SYSTEM', 'Loaded demo data', 'October 2026', '6 employees, attendance for September and October 2026, September already paid', 'System');
  return reconcile(d, ctx);
}

function assertOpen(d: Data, dates: string[]): void {
  const paid = dates.find((day) => isPaid(d, day.slice(0, 7)));
  if (paid) throw new Error(`${monthName(paid.slice(0, 7))} has already been paid, so it is locked.`);
}

// ---------- HR controls ----------

export const updateEmployeePay = (data: Data, ctx: Ctx, id: string, baseSalary: number, bonus: number) =>
  change(data, ctx, (d) => {
    const e = employee(d, id);
    const changes = [
      e.baseSalary !== baseSalary && `base salary ${money(e.baseSalary)} → ${money(baseSalary)}`,
      e.bonus !== bonus && `bonus ${money(e.bonus)} → ${money(bonus)}`,
    ].filter(Boolean);
    if (!changes.length) return;
    Object.assign(e, { baseSalary: toSen(baseSalary), bonus: toSen(bonus) });
    log(d, ctx, 'CONFIG', 'Changed pay', e.name, changes.join('; '));
  });

const CONFIG_WORDS: Record<keyof PayrollConfig, [string, (v: number) => string]> = {
  overtimeRatePerHour: ['overtime rate', (v) => `${money(v)}/hour`],
  lateToleranceMinutes: ['late tolerance', (v) => `${v} min`],
  lateRatePerMinute: ['late deduction rate', (v) => `${money(v)}/min`],
  absentDeductionPct: ['absence deduction', (v) => `${v}% of daily wage`],
  leaveDeductionPct: ['unpaid leave deduction', (v) => `${v}% of daily wage`],
};

export const updateConfig = (data: Data, ctx: Ctx, next: PayrollConfig) =>
  change(data, ctx, (d) => {
    const changed = (Object.keys(CONFIG_WORDS) as (keyof PayrollConfig)[]).filter((k) => d.config[k] !== next[k]);
    if (!changed.length) return;
    log(d, ctx, 'CONFIG', 'Changed payroll settings', 'All employees',
      changed.map((k) => `${CONFIG_WORDS[k][0]} ${CONFIG_WORDS[k][1](d.config[k])} → ${CONFIG_WORDS[k][1](next[k])}`).join('; '));
    d.config = { ...next };
  });

// ---------- Leave ----------

export function submitLeave(data: Data, ctx: Ctx, employeeId: string, input: { type: LeaveType; startDate: string; endDate: string; reason: string }, ai: LeaveClassification): Data {
  if (input.endDate < input.startDate) throw new Error('The end date is before the start date.');
  return change(data, ctx, (d) => {
    assertOpen(d, datesBetween(input.startDate, input.endDate));
    const leave: LeaveRequest = {
      id: nextId(d, 'LV'), employeeId, ...input, status: 'PENDING', label: ai.label, labelReason: ai.alasan,
      confidence: ai.keyakinan, labelSource: ai.source, createdAt: ctx.now,
    };
    d.leaves.unshift(leave);
    const who = employee(d, employeeId).name;
    log(d, ctx, 'REQUEST', 'Submitted leave request', who, `${input.type.replace('_', ' ').toLowerCase()} ${input.startDate}${input.endDate !== input.startDate ? ` to ${input.endDate}` : ''}: "${input.reason}"`);
    log(d, ctx, 'AI_LABEL', `Labelled leave ${LABEL_WORDS[ai.label]}`, who, `${ai.alasan} (confidence ${Math.round(ai.keyakinan * 100)}%)`, ai.source === 'AI' ? 'AI' : 'System (fallback)');
  });
}

export const setLeaveLabel = (data: Data, ctx: Ctx, id: string, label: LeaveLabel) =>
  change(data, ctx, (d) => {
    const leave = d.leaves.find((l) => l.id === id)!;
    if (leave.label === label) return;
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    log(d, ctx, 'AI_LABEL', 'Changed leave label', employee(d, leave.employeeId).name, `${LABEL_WORDS[leave.label]} (${leave.labelSource}) → ${LABEL_WORDS[label]}`);
    Object.assign(leave, { label, labelSource: 'HR', labelReason: `Changed by HR to ${LABEL_WORDS[label]}.` });
  });

/** A late AI answer (cold RunPod worker) replaces the keyword label, unless HR already changed it or decided. */
export const applyAiLabel = (data: Data, ctx: Ctx, id: string, ai: LeaveClassification) =>
  change(data, ctx, (d) => {
    const leave = d.leaves.find((l) => l.id === id);
    if (!leave || leave.status !== 'PENDING' || leave.labelSource === 'HR' || ai.source !== 'AI') return;
    Object.assign(leave, { label: ai.label, labelReason: ai.alasan, confidence: ai.keyakinan, labelSource: 'AI' });
    log(d, ctx, 'AI_LABEL', `Labelled leave ${LABEL_WORDS[ai.label]}`, employee(d, leave.employeeId).name, `${ai.alasan} (confidence ${Math.round(ai.keyakinan * 100)}%)`, 'AI');
  });

export const decideLeave = (data: Data, ctx: Ctx, id: string, approve: boolean) =>
  change(data, ctx, (d) => {
    const leave = d.leaves.find((l) => l.id === id)!;
    if (leave.status !== 'PENDING') throw new Error('This request has already been decided.');
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    leave.status = approve ? 'APPROVED' : 'REJECTED';
    log(d, ctx, 'DECISION', approve ? 'Approved leave' : 'Rejected leave', employee(d, leave.employeeId).name,
      approve ? `${leave.startDate} – ${leave.endDate}, label ${LABEL_WORDS[leave.label]}` : `${leave.startDate} – ${leave.endDate}`);
  });

// ---------- Overtime ----------

export function requestOvertime(data: Data, ctx: Ctx, employeeId: string, input: { date: string; hours: number; note: string }): Data {
  if (!(input.hours > 0 && input.hours <= 12)) throw new Error('Overtime must be between 0.5 and 12 hours.');
  return change(data, ctx, (d) => {
    assertOpen(d, [input.date]);
    const ot: Overtime = { id: nextId(d, 'OT'), employeeId, ...input, origin: 'EMPLOYEE', status: 'REQUESTED', createdAt: ctx.now };
    d.overtime.unshift(ot);
    log(d, ctx, 'REQUEST', 'Requested overtime', employee(d, employeeId).name, `${input.hours} h on ${input.date}: "${input.note}"`);
  });
}

export function offerOvertime(data: Data, ctx: Ctx, employeeIds: string[], input: { date: string; hours: number; note: string }): Data {
  if (!employeeIds.length) throw new Error('Choose at least one employee.');
  if (!(input.hours > 0 && input.hours <= 12)) throw new Error('Overtime must be between 0.5 and 12 hours.');
  return change(data, ctx, (d) => {
    assertOpen(d, [input.date]);
    for (const id of employeeIds) {
      const e = employee(d, id);
      d.overtime.unshift({ id: nextId(d, 'OT'), employeeId: id, ...input, origin: 'HR', status: 'OFFERED', createdAt: ctx.now });
      log(d, ctx, 'REQUEST', 'Offered overtime', e.name, `${input.hours} h on ${input.date}: "${input.note}"`);
      sendWhatsApp(d, ctx, e, 'OVERTIME_OFFER',
        `Hi ${e.name.split(' ')[0]}, HR is offering you ${input.hours} hours of overtime on ${input.date} (${money(input.hours * d.config.overtimeRatePerHour)}). ${input.note} Please accept or decline in e-Salary Guard.`);
    }
  });
}

const OT_NEXT: Record<string, Overtime['status'][]> = {
  APPROVED: ['REQUESTED'], REJECTED: ['REQUESTED'], ACCEPTED: ['OFFERED'], DECLINED: ['OFFERED'], COMPLETED: ['APPROVED', 'ACCEPTED'],
};
const OT_WORDS: Record<string, string> = {
  APPROVED: 'Approved overtime', REJECTED: 'Rejected overtime', ACCEPTED: 'Accepted overtime offer', DECLINED: 'Declined overtime offer', COMPLETED: 'Marked overtime as done',
};

/** HR approves/rejects a request; the employee accepts/declines an offer, then marks it done. */
export const moveOvertime = (data: Data, ctx: Ctx, id: string, to: 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED') =>
  change(data, ctx, (d) => {
    const ot = d.overtime.find((o) => o.id === id)!;
    if (!OT_NEXT[to].includes(ot.status)) throw new Error('This overtime can no longer be changed that way.');
    assertOpen(d, [ot.date]);
    ot.status = to;
    log(d, ctx, 'DECISION', OT_WORDS[to], employee(d, ot.employeeId).name, `${ot.hours} h on ${ot.date}`);
  });

// ---------- Payroll ----------

export function payMonth(data: Data, ctx: Ctx, month: Month): Data {
  if (isPaid(data, month)) throw new Error(`${monthName(month)} has already been paid.`);
  const d = structuredClone(data);
  const yyyymm = month.replace('-', '');
  const lines: PaymentLine[] = d.employees.map((e, i) => ({
    ...payrollFor(d, e.id, month), reference: `PAY-${yyyymm}-${String(i + 1).padStart(3, '0')}`, employeeName: e.name,
  }));
  const total = toSen(lines.reduce((t, l) => t + l.netPay, 0));
  d.payments.unshift({ month, paidAt: ctx.now, paidBy: ctx.actor.replace(/^HR: /, ''), total, lines });
  log(d, ctx, 'PAYMENT', `Paid ${monthName(month)} payroll (simulated)`, `${lines.length} employees`,
    `${money(total)} · ${lines[0].reference} to ${lines[lines.length - 1].reference}`);
  return d;
}

export function logLogin(data: Data, ctx: Ctx, who: string): Data {
  const d = structuredClone(data);
  log(d, ctx, 'LOGIN', 'Signed in', who, '', who);
  return d;
}
