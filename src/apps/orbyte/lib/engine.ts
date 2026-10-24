// Every change to the demo data, as pure functions: (data, input) → new data.
// After each change `reconcile` recalculates pay, logs net-pay changes and sends (simulated) WhatsApp messages.
// Nothing in a paid month can change (`assertOpen`), and every reversal or edit is written to the activity log.
import { money, monthName, toSen } from './format';
import { computePayroll, datesBetween, deductionMessage, workingDays } from './payroll';
import { LABEL_BY, LEAVE_PAY } from './words';
import { accountsOf, DEFAULT_LEAVE_DAYS, DEMO_MONTH, DIVISIONS, EMPLOYEES, importAttendance, seedState } from './seed';
import type {
  ActivityEntry, ActivityKind, AttendanceOverride, AttendanceRecord, Employee, HrNotification, ISODate, LeaveClassification,
  LeaveLabel, LeaveRequest, LeaveType, Month, Overtime, PaymentLine, PaymentRun, PayrollBreakdown, PayrollConfig, WhatsAppMessage,
} from './types';

export const DATA_VERSION = 2;

export interface Data extends ReturnType<typeof seedState> {
  version: number;
  attendanceOverrides: Record<string, AttendanceOverride>; // "E3|2026-10-14" → HR's correction (imported data stays as is)
  divisionOvertime: Record<string, number>; // division → overtime rate per hour, overriding the global rule
  notifications: HrNotification[];
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

type LeaveInput = { type: LeaveType; startDate: string; endDate: string; reason: string };
type OvertimeInput = { date: string; hours: number; note: string };

/** Screen words for a leave label (lib/words.ts); also used in log entries. */
export const LABEL_WORDS: Record<LeaveLabel, string> = LEAVE_PAY;

/** The calendar date in Malaysia (UTC+8) for an ISO timestamp: the demo's "today". */
export const todayOf = (now: string): ISODate => new Date(Date.parse(now) + 8 * 3_600_000).toISOString().slice(0, 10);

const nextId = (d: Data, prefix: string) => `${prefix}-${++d.seq}`;

function log(d: Data, ctx: Ctx, kind: ActivityKind, action: string, target: string, detail = '', actor = ctx.actor): void {
  d.activity.unshift({ id: nextId(d, 'LOG'), at: ctx.now, actor, kind, action, target, detail });
}

function notify(d: Data, ctx: Ctx, text: string): void {
  d.notifications.unshift({ id: nextId(d, 'N'), at: ctx.now, text, read: false });
}

function sendWhatsApp(d: Data, ctx: Ctx, employee: Employee, kind: WhatsAppMessage['kind'], text: string): void {
  d.whatsapp.unshift({ id: nextId(d, 'WA'), employeeId: employee.id, to: employee.whatsapp, at: ctx.now, kind, text });
  log(d, ctx, 'WHATSAPP', kind === 'OVERTIME_OFFER' ? 'Sent overtime offer by WhatsApp' : 'Sent deduction alert by WhatsApp', employee.name, text, 'System');
}

export const isPaid = (d: Data, month: Month) => d.payments.some((p) => p.month === month);
const employee = (d: Data, id: string) => d.employees.find((e) => e.id === id)!;

/** Overtime rate for an employee: their division's override, else the global rule. */
export const overtimeRate = (d: Data, e: Employee) => d.divisionOvertime[e.division] ?? d.config.overtimeRatePerHour;
const configFor = (d: Data, e: Employee): PayrollConfig => ({ ...d.config, overtimeRatePerHour: overtimeRate(d, e) });

const clockAt = (minutesLate: number) => {
  const total = 8 * 60 + minutesLate;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** An employee's attendance: the imported records with HR's corrections applied on top. */
export function attendanceOf(d: Data, employeeId: string): AttendanceRecord[] {
  return d.attendance.filter((a) => a.employeeId === employeeId).map((a) => {
    const o = d.attendanceOverrides[`${employeeId}|${a.date}`];
    if (!o) return a;
    const present = o.status === 'PRESENT';
    return {
      ...a, clockIn: present ? (a.clockIn && a.lateMinutes === o.lateMinutes ? a.clockIn : clockAt(o.lateMinutes)) : undefined,
      lateMinutes: present ? o.lateMinutes : 0, izin: o.status === 'IZIN', editedByHr: true,
    };
  });
}

/** Pay for one employee: the frozen snapshot if the month is paid, otherwise calculated live. */
export function payrollFor(d: Data, employeeId: string, month: Month): PayrollBreakdown | PaymentLine {
  const paid = d.payments.find((p) => p.month === month)?.lines.find((l) => l.employeeId === employeeId);
  if (paid) return paid;
  const e = employee(d, employeeId);
  return computePayroll({
    employee: e, month, config: configFor(d, e), attendance: attendanceOf(d, employeeId), today: d.today,
    leaves: d.leaves.filter((l) => l.employeeId === employeeId),
    overtime: d.overtime.filter((o) => o.employeeId === employeeId),
  });
}

/** Recalculate the current month; log changed take-home pay; WhatsApp new, changed or removed deductions. */
export function reconcile(d: Data, ctx: Ctx): Data {
  if (isPaid(d, DEMO_MONTH)) return d; // a paid month is locked
  const label = monthName(DEMO_MONTH, 'en');
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

/** A new day brings in the attendance imported since (raw data only grows; HR corrections are kept apart). */
function catchUpToToday(d: Data, ctx: Ctx): void {
  const today = todayOf(ctx.now);
  if (d.today === today) return;
  d.today = today;
  d.attendance = importAttendance(today, d.employees);
}

/** Applies a change to a copy of the data, then reconciles. */
function change(data: Data, ctx: Ctx, edit: (d: Data) => void): Data {
  const d = structuredClone(data);
  catchUpToToday(d, ctx);
  edit(d);
  return reconcile(d, ctx);
}

/** Brings the data to today: new attendance, recalculated pay, WhatsApp for deductions that appeared since. */
export const refresh = (data: Data, ctx: Ctx) => change(data, ctx, () => {});

export function freshData(ctx: Ctx): Data {
  const d: Data = {
    ...seedState(todayOf(ctx.now)), version: DATA_VERSION, attendanceOverrides: {}, divisionOvertime: {}, notifications: [],
    whatsapp: [], activity: [], notified: {}, lastNet: {}, seq: 0,
  };
  log(d, ctx, 'SYSTEM', 'Loaded demo data', 'October 2026', '6 employees, attendance for September and October 2026 up to yesterday, September already paid', 'System');
  return reconcile(d, ctx);
}

/** Data saved by an older version (v1) gets the new fields; requests, payments, messages and the log are kept. */
export function migrate(saved: Data, ctx: Ctx): Data {
  const d = structuredClone(saved);
  if ((d.version ?? 1) < DATA_VERSION) {
    d.employees = d.employees.map((e) => {
      const seed = EMPLOYEES.find((s) => s.id === e.id);
      return { ...e, division: e.division ?? seed?.division ?? DIVISIONS[0], annualLeaveDays: e.annualLeaveDays ?? DEFAULT_LEAVE_DAYS };
    });
    d.attendanceOverrides ??= {};
    d.divisionOvertime ??= {};
    d.notifications ??= [];
    d.version = DATA_VERSION;
    log(d, ctx, 'SYSTEM', 'Updated saved demo data', 'All data', 'Added divisions, leave allowances, attendance corrections and HR notifications. Nothing was removed.', 'System');
  }
  return refresh(d, ctx);
}

/** Why a period can't change ("This period has been paid"), or null. Shown next to disabled buttons. */
export function paidReason(d: Data, dates: string[]): string | null {
  const paid = dates.find((day) => isPaid(d, day.slice(0, 7)));
  return paid ? `This period has been paid (${monthName(paid.slice(0, 7), 'en')})` : null;
}

function assertOpen(d: Data, dates: string[]): void {
  const paid = dates.find((day) => isPaid(d, day.slice(0, 7)));
  if (paid) throw new Error(`${monthName(paid.slice(0, 7), 'en')} has already been paid, so it is locked.`);
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

/** A division's own overtime rate; null goes back to the global default. */
export const setDivisionOvertime = (data: Data, ctx: Ctx, division: string, rate: number | null) =>
  change(data, ctx, (d) => {
    if (rate !== null && !(Number.isFinite(rate) && rate >= 0)) throw new Error('The overtime rate must be 0 or more.');
    const before = d.divisionOvertime[division];
    if (before === (rate ?? undefined)) return;
    const word = (v: number | undefined) => (v === undefined ? `default (${money(d.config.overtimeRatePerHour)}/hour)` : `${money(v)}/hour`);
    if (rate === null) delete d.divisionOvertime[division];
    else d.divisionOvertime[division] = toSen(rate);
    log(d, ctx, 'CONFIG', 'Changed division overtime rate', division, `${word(before)} → ${word(rate ?? undefined)}`);
  });

/** "Leave"-type working days approved in a year (other types don't use the allowance). */
export function leaveUsed(d: Data, employeeId: string, year = DEMO_MONTH.slice(0, 4)): number {
  return d.leaves
    .filter((l) => l.employeeId === employeeId && l.type === 'LEAVE' && l.status === 'APPROVED')
    .flatMap((l) => datesBetween(l.startDate, l.endDate))
    .filter((day) => day.startsWith(year) && workingDays(day.slice(0, 7)).includes(day)).length;
}

export const updateLeaveAllowance = (data: Data, ctx: Ctx, id: string, days: number) =>
  change(data, ctx, (d) => {
    if (!Number.isInteger(days) || days < 0) throw new Error('Enter a whole number of days, 0 or more.');
    const e = employee(d, id);
    if (e.annualLeaveDays === days) return;
    log(d, ctx, 'CONFIG', 'Changed annual leave allowance', e.name, `${e.annualLeaveDays} → ${days} days (${leaveUsed(d, id)} used)`);
    e.annualLeaveDays = days;
  });

export type NewWorker = { name: string; position: string; division: string; baseSalary: number; bonus: number };
const MAX_WORKERS = 40;

/** HR adds a worker: they can sign in at once, and start today (days before that are never counted as absent). */
export const addEmployee = (data: Data, ctx: Ctx, input: NewWorker) =>
  change(data, ctx, (d) => {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const position = input.position.trim();
    if (name.length < 2 || name.length > 60) throw new Error('Enter a name of 2 to 60 characters.');
    if (position.length < 2 || position.length > 60) throw new Error('Enter a position of 2 to 60 characters.');
    if (!DIVISIONS.includes(input.division)) throw new Error('Pick one of the departments.');
    if (![input.baseSalary, input.bonus].every((v) => Number.isFinite(v) && v >= 0 && v <= 100_000)) throw new Error('Salary and bonus must be between RM 0 and RM 100,000.');
    if (d.employees.length >= MAX_WORKERS) throw new Error(`This demo holds up to ${MAX_WORKERS} workers.`);
    if (d.employees.some((e) => e.name.toLowerCase() === name.toLowerCase())) throw new Error(`${name} is already a worker.`);
    const n = Math.max(0, ...d.employees.map((e) => Number(e.id.slice(1)) || 0)) + 1;
    const e: Employee = {
      id: `E${n}`, name, position, whatsapp: `+60 12-345 ${1000 + n}`, baseSalary: toSen(input.baseSalary), bonus: toSen(input.bonus),
      division: input.division, annualLeaveDays: DEFAULT_LEAVE_DAYS, startDate: d.today,
    };
    d.employees.push(e);
    d.attendance = importAttendance(d.today, d.employees);
    const email = accountsOf(d.employees).find((a) => a.employeeId === e.id)!.email;
    log(d, ctx, 'PEOPLE', 'Added a worker', name, `${position} · ${e.division} · base ${money(e.baseSalary)} · signs in as ${email}`);
  });

const MESSAGE_MAX = 500;
function messageText(text: string): string {
  const clean = text.trim();
  if (!clean) throw new Error('Write a message first.');
  if (clean.length > MESSAGE_MAX) throw new Error(`Keep the message under ${MESSAGE_MAX} characters.`);
  return clean;
}

/** One conversation per worker: HR writes to them (simulated WhatsApp), they answer HR. */
export const sendMessage = (data: Data, ctx: Ctx, employeeId: string, text: string, from: 'HR' | 'WORKER' = 'HR') =>
  change(data, ctx, (d) => {
    const e = d.employees.find((x) => x.id === employeeId);
    if (!e) throw new Error('That worker does not exist.');
    const hr = from === 'HR';
    d.whatsapp.unshift({ id: nextId(d, 'WA'), employeeId: e.id, to: hr ? e.whatsapp : 'HR', at: ctx.now, kind: hr ? 'HR_MESSAGE' : 'REPLY', text: messageText(text) });
    log(d, ctx, 'WHATSAPP', hr ? 'Sent a message' : 'Replied to HR', hr ? e.name : 'HR');
  });

const describeDay = (r: AttendanceRecord | undefined) =>
  !r ? 'no record' : r.izin ? 'permitted absence' : !r.clockIn ? 'absent' : r.lateMinutes ? `present, ${r.lateMinutes} min late` : 'present, on time';

/** HR corrects one day (null = back to the imported value). Only days that have happened, never in a paid month. */
export const setAttendance = (data: Data, ctx: Ctx, employeeId: string, day: ISODate, value: { status: AttendanceOverride['status']; lateMinutes: number } | null, action = 'Edited attendance') =>
  change(data, ctx, (d) => {
    if (!d.attendance.some((a) => a.employeeId === employeeId && a.date === day)) throw new Error('Only working days that have already happened can be edited.');
    assertOpen(d, [day]);
    const key = `${employeeId}|${day}`;
    const before = describeDay(attendanceOf(d, employeeId).find((a) => a.date === day));
    if (value === null) {
      if (!d.attendanceOverrides[key]) return;
      delete d.attendanceOverrides[key];
    } else {
      const late = value.status === 'PRESENT' ? value.lateMinutes : 0;
      if (!Number.isInteger(late) || late < 0 || late > 600) throw new Error('Minutes late must be a whole number from 0 to 600.');
      d.attendanceOverrides[key] = { status: value.status, lateMinutes: late, by: ctx.actor, at: ctx.now };
    }
    const after = describeDay(attendanceOf(d, employeeId).find((a) => a.date === day));
    log(d, ctx, 'ATTENDANCE', value === null ? 'Reset attendance to the imported value' : action, employee(d, employeeId).name, `${day}: ${before} → ${after}`);
  });

/** The latest working day of the month that has already happened for this employee (null before the month starts). */
export const lastWorkedDay = (d: Data, employeeId: string, month: Month = DEMO_MONTH): ISODate | null =>
  d.attendance.filter((a) => a.employeeId === employeeId && a.date.startsWith(month)).map((a) => a.date).sort().at(-1) ?? null;

/**
 * Demo button: makes something happen on the last working day that has passed ("today" follows the real date, so today's
 * attendance does not exist yet), so the deduction, WhatsApp alert and payslip change can be shown at once. Undo = reset that day.
 */
export function simulateEvent(data: Data, ctx: Ctx, employeeId: string, kind: 'LATE' | 'ABSENT'): Data {
  const day = lastWorkedDay(data, employeeId);
  if (!day) throw new Error('No working day of this month has passed yet.');
  const now = attendanceOf(data, employeeId).find((a) => a.date === day)!;
  const value = kind === 'ABSENT' ? { status: 'ABSENT' as const, lateMinutes: 0 } : { status: 'PRESENT' as const, lateMinutes: Math.max(25, now.lateMinutes + 15) };
  return setAttendance(data, ctx, employeeId, day, value, 'Simulated attendance event (demo)');
}

/** Monthly counts for the attendance screen. Izin = days HR marked izin + approved "Permission" leave days. */
export function attendanceSummary(d: Data, employeeId: string, month: Month) {
  const p = payrollFor(d, employeeId, month);
  const records = attendanceOf(d, employeeId).filter((a) => a.date.startsWith(month));
  const permission = d.leaves
    .filter((l) => l.employeeId === employeeId && l.type === 'PERMISSION' && l.status === 'APPROVED')
    .flatMap((l) => datesBetween(l.startDate, l.endDate))
    .filter((day) => workingDays(month).includes(day)).length;
  return {
    absent: p.events.filter((e) => e.kind === 'ABSENT').length,
    izin: records.filter((r) => r.izin).length + permission,
    late: p.events.filter((e) => e.kind === 'LATE').length,
    edited: records.filter((r) => r.editedByHr).length,
  };
}

// ---------- Leave ----------

const span = (l: { startDate: string; endDate: string }) => `${l.startDate}${l.endDate !== l.startDate ? ` to ${l.endDate}` : ''}`;
const leaveWords = (l: LeaveInput) => `${l.type.replace('_', ' ').toLowerCase()} ${span(l)}: "${l.reason}"`;
const STATUS_WORDS: Record<string, string> = { APPROVED: 'Approved', REJECTED: 'Rejected' };

function leaveById(d: Data, id: string): LeaveRequest {
  const leave = d.leaves.find((l) => l.id === id);
  if (!leave) throw new Error('This request no longer exists.');
  return leave;
}

/** Why an employee can't cancel an approved leave, or null. */
export function leaveCancelBlock(d: Data, l: LeaveRequest): string | null {
  return paidReason(d, datesBetween(l.startDate, l.endDate)) ?? (l.startDate <= d.today ? 'This leave has already been taken' : null);
}

/** Saved at once as pending with the keyword label; `aiPending` = the AI's label will replace it when it answers. */
export function submitLeave(data: Data, ctx: Ctx, employeeId: string, input: LeaveInput, ai: LeaveClassification, aiPending = false): Data {
  if (input.endDate < input.startDate) throw new Error('The end date is before the start date.');
  return change(data, ctx, (d) => {
    assertOpen(d, datesBetween(input.startDate, input.endDate));
    const leave: LeaveRequest = {
      id: nextId(d, 'LV'), employeeId, ...input, status: 'PENDING', label: ai.label, labelReason: ai.alasan,
      confidence: ai.keyakinan, labelSource: ai.source, aiPending, createdAt: ctx.now,
    };
    d.leaves.unshift(leave);
    const who = employee(d, employeeId).name;
    log(d, ctx, 'REQUEST', 'Submitted leave request', who, leaveWords(input));
    log(d, ctx, 'AI_LABEL', `Labelled leave ${LABEL_WORDS[ai.label]}`, who, `${ai.alasan} (confidence ${Math.round(ai.keyakinan * 100)}%)`, ai.source === 'AI' ? 'AI' : 'System (keyword check)');
  });
}

/** The employee changes a request that HR has not decided yet. HR is notified; the AI reads the new reason. */
export function editLeave(data: Data, ctx: Ctx, id: string, input: LeaveInput, ai: LeaveClassification): Data {
  if (input.endDate < input.startDate) throw new Error('The end date is before the start date.');
  return change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'PENDING') throw new Error('Only a request that is still waiting for HR can be edited.');
    assertOpen(d, [...datesBetween(leave.startDate, leave.endDate), ...datesBetween(input.startDate, input.endDate)]);
    const before = leaveWords(leave);
    Object.assign(leave, {
      ...input, label: ai.label, labelReason: ai.alasan, confidence: ai.keyakinan, labelSource: ai.source, aiPending: true, editedAt: ctx.now,
    });
    const who = employee(d, leave.employeeId).name;
    log(d, ctx, 'REQUEST', 'Edited leave request', who, `${before} → ${leaveWords(leave)}`);
    notify(d, ctx, `${who} edited a pending leave request (${span(leave)}). Review the new version.`);
  });
}

export const withdrawLeave = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'PENDING') throw new Error('Only a request that is still waiting for HR can be withdrawn.');
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    leave.status = 'WITHDRAWN';
    const who = employee(d, leave.employeeId).name;
    log(d, ctx, 'REQUEST', 'Withdrew leave request', who, leaveWords(leave));
    notify(d, ctx, `${who} withdrew a pending leave request (${span(leave)}). Nothing to review.`);
  });

export const requestLeaveCancellation = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'APPROVED' || leave.cancelRequestedAt) throw new Error('Only an approved leave can be cancelled, once.');
    const blocked = leaveCancelBlock(d, leave);
    if (blocked) throw new Error(`${blocked}.`);
    leave.cancelRequestedAt = ctx.now;
    log(d, ctx, 'REQUEST', 'Asked to cancel approved leave', employee(d, leave.employeeId).name, leaveWords(leave));
  });

/** HR approves (→ Cancelled, allowance and pay restored) or rejects (the approval stays) a cancellation request. */
export const decideLeaveCancellation = (data: Data, ctx: Ctx, id: string, approve: boolean) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'APPROVED' || !leave.cancelRequestedAt) throw new Error('There is no cancellation request for this leave.');
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    delete leave.cancelRequestedAt;
    if (approve) Object.assign(leave, { status: 'CANCELLED', decidedAt: ctx.now, decidedBy: ctx.actor });
    log(d, ctx, 'DECISION', approve ? 'Approved leave cancellation' : 'Rejected leave cancellation', employee(d, leave.employeeId).name,
      approve ? `${span(leave)} cancelled` : `${span(leave)} stays approved`);
  });

export const setLeaveLabel = (data: Data, ctx: Ctx, id: string, label: LeaveLabel) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.label === label) return;
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    log(d, ctx, 'AI_LABEL', 'Changed leave label', employee(d, leave.employeeId).name, `${LABEL_WORDS[leave.label]} (${LABEL_BY[leave.labelSource]}) → ${LABEL_WORDS[label]}`);
    Object.assign(leave, { label, labelSource: 'HR', labelReason: `Set by HR to ${LABEL_WORDS[label].toLowerCase()}.`, aiPending: false });
  });

/**
 * The AI's answer arrives (it runs in the background). Ignored if the reason was edited since, or if the request is no
 * longer waiting for its label; a failed AI (keyword answer) only ends the waiting.
 */
export const applyAiLabel = (data: Data, ctx: Ctx, id: string, ai: LeaveClassification, reason: string) =>
  change(data, ctx, (d) => {
    const leave = d.leaves.find((l) => l.id === id);
    if (!leave || !leave.aiPending || leave.reason !== reason) return;
    leave.aiPending = false;
    if (leave.status !== 'PENDING' || leave.labelSource === 'HR' || ai.source !== 'AI') return;
    Object.assign(leave, { label: ai.label, labelReason: ai.alasan, confidence: ai.keyakinan, labelSource: 'AI' });
    log(d, ctx, 'AI_LABEL', `Labelled leave ${LABEL_WORDS[ai.label]}`, employee(d, leave.employeeId).name, `${ai.alasan} (confidence ${Math.round(ai.keyakinan * 100)}%)`, 'AI');
  });

export const decideLeave = (data: Data, ctx: Ctx, id: string, approve: boolean) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'PENDING') throw new Error('This request has already been decided.');
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    Object.assign(leave, { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: ctx.now, decidedBy: ctx.actor });
    log(d, ctx, 'DECISION', approve ? 'Approved leave' : 'Rejected leave', employee(d, leave.employeeId).name,
      approve ? `${span(leave)}, label ${LABEL_WORDS[leave.label]}` : span(leave));
  });

/** HR undoes an approval or rejection: back to pending, decision cleared, pay recalculated. */
export const revertLeave = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const leave = leaveById(d, id);
    if (leave.status !== 'APPROVED' && leave.status !== 'REJECTED') throw new Error('Only an approved or rejected request can go back to pending.');
    assertOpen(d, datesBetween(leave.startDate, leave.endDate));
    const was = `was ${STATUS_WORDS[leave.status]}${leave.decidedBy ? ` by ${leave.decidedBy}` : ''}${leave.decidedAt ? ` at ${leave.decidedAt}` : ''}`;
    leave.status = 'PENDING';
    delete leave.decidedAt;
    delete leave.decidedBy;
    delete leave.cancelRequestedAt;
    log(d, ctx, 'REVERT', 'Undid leave decision (back to waiting)', employee(d, leave.employeeId).name, `${span(leave)} · ${was}`);
  });

// ---------- Overtime ----------

function overtimeById(d: Data, id: string): Overtime {
  const ot = d.overtime.find((o) => o.id === id);
  if (!ot) throw new Error('This overtime no longer exists.');
  return ot;
}

const checkHours = (hours: number) => {
  if (!(hours > 0 && hours <= 12)) throw new Error('Overtime must be between 0.5 and 12 hours.');
};

/** Why an employee can't cancel approved/accepted overtime, or null. */
export function overtimeCancelBlock(d: Data, o: Overtime): string | null {
  return paidReason(d, [o.date]) ?? (o.status === 'COMPLETED' || o.date <= d.today ? 'This overtime has already been worked' : null);
}

export function requestOvertime(data: Data, ctx: Ctx, employeeId: string, input: OvertimeInput): Data {
  checkHours(input.hours);
  return change(data, ctx, (d) => {
    assertOpen(d, [input.date]);
    const ot: Overtime = { id: nextId(d, 'OT'), employeeId, ...input, origin: 'EMPLOYEE', status: 'REQUESTED', createdAt: ctx.now };
    d.overtime.unshift(ot);
    log(d, ctx, 'REQUEST', 'Requested overtime', employee(d, employeeId).name, `${input.hours} h on ${input.date}: "${input.note}"`);
  });
}

export function editOvertime(data: Data, ctx: Ctx, id: string, input: OvertimeInput): Data {
  checkHours(input.hours);
  return change(data, ctx, (d) => {
    const ot = overtimeById(d, id);
    if (ot.status !== 'REQUESTED') throw new Error('Only a request that is still waiting for HR can be edited.');
    assertOpen(d, [ot.date, input.date]);
    const before = `${ot.hours} h on ${ot.date}: "${ot.note}"`;
    Object.assign(ot, { ...input, editedAt: ctx.now });
    const who = employee(d, ot.employeeId).name;
    log(d, ctx, 'REQUEST', 'Edited overtime request', who, `${before} → ${ot.hours} h on ${ot.date}: "${ot.note}"`);
    notify(d, ctx, `${who} edited a pending overtime request (${ot.date}). Review the new version.`);
  });
}

export const withdrawOvertime = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const ot = overtimeById(d, id);
    if (ot.status !== 'REQUESTED') throw new Error('Only a request that is still waiting for HR can be withdrawn.');
    assertOpen(d, [ot.date]);
    ot.status = 'WITHDRAWN';
    const who = employee(d, ot.employeeId).name;
    log(d, ctx, 'REQUEST', 'Withdrew overtime request', who, `${ot.hours} h on ${ot.date}`);
    notify(d, ctx, `${who} withdrew a pending overtime request (${ot.date}). Nothing to review.`);
  });

export function offerOvertime(data: Data, ctx: Ctx, employeeIds: string[], input: OvertimeInput): Data {
  if (!employeeIds.length) throw new Error('Choose at least one employee.');
  checkHours(input.hours);
  return change(data, ctx, (d) => {
    assertOpen(d, [input.date]);
    for (const id of employeeIds) {
      const e = employee(d, id);
      d.overtime.unshift({ id: nextId(d, 'OT'), employeeId: id, ...input, origin: 'HR', status: 'OFFERED', createdAt: ctx.now });
      log(d, ctx, 'REQUEST', 'Offered overtime', e.name, `${input.hours} h on ${input.date}: "${input.note}"`);
      sendWhatsApp(d, ctx, e, 'OVERTIME_OFFER',
        `Hi ${e.name.split(' ')[0]}, HR is offering you ${input.hours} hours of overtime on ${input.date} (${money(input.hours * overtimeRate(d, e))}). ${input.note} Please accept or decline in e-Salary Guard.`);
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
    const ot = overtimeById(d, id);
    if (!OT_NEXT[to].includes(ot.status) || ot.cancelRequestedAt) throw new Error('This overtime can no longer be changed that way.');
    assertOpen(d, [ot.date]);
    ot.status = to;
    if (to === 'APPROVED' || to === 'REJECTED') Object.assign(ot, { decidedAt: ctx.now, decidedBy: ctx.actor });
    log(d, ctx, 'DECISION', OT_WORDS[to], employee(d, ot.employeeId).name, `${ot.hours} h on ${ot.date}`);
  });

/** HR undoes an approval or rejection of an employee's request. Worked (done) overtime can't go back. */
export const revertOvertime = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const ot = overtimeById(d, id);
    if (ot.status === 'COMPLETED') throw new Error('This overtime has been worked and marked done, so it can no longer go back to pending.');
    if (ot.origin !== 'EMPLOYEE' || (ot.status !== 'APPROVED' && ot.status !== 'REJECTED')) throw new Error('Only an approved or rejected request can go back to pending.');
    assertOpen(d, [ot.date]);
    const was = `was ${STATUS_WORDS[ot.status]}${ot.decidedBy ? ` by ${ot.decidedBy}` : ''}${ot.decidedAt ? ` at ${ot.decidedAt}` : ''}`;
    ot.status = 'REQUESTED';
    delete ot.decidedAt;
    delete ot.decidedBy;
    delete ot.cancelRequestedAt;
    log(d, ctx, 'REVERT', 'Undid overtime decision (back to waiting)', employee(d, ot.employeeId).name, `${ot.hours} h on ${ot.date} · ${was}`);
  });

export const requestOvertimeCancellation = (data: Data, ctx: Ctx, id: string) =>
  change(data, ctx, (d) => {
    const ot = overtimeById(d, id);
    if ((ot.status !== 'APPROVED' && ot.status !== 'ACCEPTED') || ot.cancelRequestedAt) throw new Error('Only approved or accepted overtime can be cancelled, once.');
    const blocked = overtimeCancelBlock(d, ot);
    if (blocked) throw new Error(`${blocked}.`);
    ot.cancelRequestedAt = ctx.now;
    log(d, ctx, 'REQUEST', 'Asked to cancel overtime', employee(d, ot.employeeId).name, `${ot.hours} h on ${ot.date}`);
  });

export const decideOvertimeCancellation = (data: Data, ctx: Ctx, id: string, approve: boolean) =>
  change(data, ctx, (d) => {
    const ot = overtimeById(d, id);
    if (!ot.cancelRequestedAt) throw new Error('There is no cancellation request for this overtime.');
    assertOpen(d, [ot.date]);
    delete ot.cancelRequestedAt;
    if (approve) Object.assign(ot, { status: 'CANCELLED', decidedAt: ctx.now, decidedBy: ctx.actor });
    log(d, ctx, 'DECISION', approve ? 'Approved overtime cancellation' : 'Rejected overtime cancellation', employee(d, ot.employeeId).name,
      `${ot.hours} h on ${ot.date}${approve ? ' cancelled' : ' stays'}`);
  });

// ---------- Payroll ----------

/** The running month shaped like a payment (no references yet), so history and payslips can show it. Null once paid. */
export function draftRun(d: Data, month: Month): PaymentRun | null {
  if (isPaid(d, month)) return null;
  const lines: PaymentLine[] = d.employees.map((e) => ({ ...payrollFor(d, e.id, month), reference: '', employeeName: e.name }));
  return { month, paidAt: '', paidBy: '', total: toSen(lines.reduce((t, l) => t + l.netPay, 0)), lines, draft: true };
}

export function payMonth(data: Data, ctx: Ctx, month: Month): Data {
  if (isPaid(data, month)) throw new Error(`${monthName(month, 'en')} has already been paid.`);
  const d = structuredClone(data);
  const yyyymm = month.replace('-', '');
  const lines: PaymentLine[] = d.employees.map((e, i) => ({
    ...payrollFor(d, e.id, month), reference: `PAY-${yyyymm}-${String(i + 1).padStart(3, '0')}`, employeeName: e.name,
  }));
  const total = toSen(lines.reduce((t, l) => t + l.netPay, 0));
  d.payments.unshift({ month, paidAt: ctx.now, paidBy: ctx.actor.replace(/^HR: /, ''), total, lines });
  log(d, ctx, 'PAYMENT', `Paid ${monthName(month, 'en')} payroll (simulated)`, `${lines.length} employees`,
    `${money(total)} · ${lines[0].reference} to ${lines[lines.length - 1].reference}`);
  return d;
}

export function logLogin(data: Data, ctx: Ctx, who: string): Data {
  const d = structuredClone(data);
  log(d, ctx, 'LOGIN', 'Signed in', who, '', who);
  return d;
}

export function markNotificationsRead(data: Data): Data {
  const d = structuredClone(data);
  for (const n of d.notifications) n.read = true;
  return d;
}
