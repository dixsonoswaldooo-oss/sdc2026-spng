// Every change the browser may ask the server to make, who may make it, and how. Pure (no database), so it is tested.
// The browser is not trusted: the role and the employee come from the signed session, never from the request,
// arguments are type-checked, and an employee can only touch their own requests. Business rules stay in engine.ts.
import * as engine from '../engine';
import { keywordClassify } from '../leaveClassifier';
import type { Account, AttendanceOverride, LeaveType, PayrollConfig } from '../types';

type Data = engine.Data;
type Ctx = engine.Ctx;
type Who = 'HR' | 'EMPLOYEE';

interface Rule {
  who: Who | ((args: unknown[]) => Who);
  valid: (args: unknown[]) => boolean;
  /** For employee actions on an existing request: the request's id is args[0] and must be theirs. */
  owned?: 'leave' | 'overtime';
  run: (d: Data, ctx: Ctx, args: unknown[], employeeId: string) => Data;
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const LEAVE_TYPES: LeaveType[] = ['LEAVE', 'PERMISSION', 'SICK', 'DAY_OFF'];
const leaveInput = (v: unknown): v is { type: LeaveType; startDate: string; endDate: string; reason: string } => {
  const x = v as Record<string, unknown>;
  return !!x && LEAVE_TYPES.includes(x.type as LeaveType) && day(x.startDate) && day(x.endDate) && typeof x.reason === 'string' && x.reason.length <= 1000;
};
const otInput = (v: unknown): v is { date: string; hours: number; note: string } => {
  const x = v as Record<string, unknown>;
  return !!x && day(x.date) && num(x.hours) && typeof x.note === 'string' && x.note.length <= 1000;
};
const CONFIG_KEYS: (keyof PayrollConfig)[] = ['overtimeRatePerHour', 'lateToleranceMinutes', 'lateRatePerMinute', 'absentDeductionPct', 'leaveDeductionPct'];
const config = (v: unknown): v is PayrollConfig => !!v && CONFIG_KEYS.every((k) => num((v as Record<string, unknown>)[k]));
const attendanceValue = (v: unknown): v is { status: AttendanceOverride['status']; lateMinutes: number } | null =>
  v === null || (!!v && ['PRESENT', 'ABSENT', 'IZIN'].includes((v as Record<string, unknown>).status as string) && num((v as Record<string, unknown>).lateMinutes));
const OT_MOVES = ['APPROVED', 'REJECTED', 'ACCEPTED', 'DECLINED', 'COMPLETED'] as const;
type OtMove = (typeof OT_MOVES)[number];

export const ACTIONS: Record<string, Rule> = {
  // ---- HR ----
  updateEmployeePay: { who: 'HR', valid: ([id, base, bonus]) => str(id) && num(base) && num(bonus), run: (d, c, [id, base, bonus]) => engine.updateEmployeePay(d, c, id as string, base as number, bonus as number) },
  updateConfig: { who: 'HR', valid: ([c]) => config(c), run: (d, c, [next]) => engine.updateConfig(d, c, next as PayrollConfig) },
  setDivisionOvertime: { who: 'HR', valid: ([div, rate]) => str(div) && (rate === null || num(rate)), run: (d, c, [div, rate]) => engine.setDivisionOvertime(d, c, div as string, rate as number | null) },
  updateLeaveAllowance: { who: 'HR', valid: ([id, days]) => str(id) && num(days), run: (d, c, [id, days]) => engine.updateLeaveAllowance(d, c, id as string, days as number) },
  setAttendance: {
    who: 'HR', valid: ([id, when, value]) => str(id) && day(when) && attendanceValue(value),
    run: (d, c, [id, when, value]) => engine.setAttendance(d, c, id as string, when as string, value as { status: AttendanceOverride['status']; lateMinutes: number } | null),
  },
  setLeaveLabel: { who: 'HR', valid: ([id, label]) => str(id) && (label === 'DITOLERANSI' || label === 'DIPOTONG'), run: (d, c, [id, label]) => engine.setLeaveLabel(d, c, id as string, label as 'DITOLERANSI' | 'DIPOTONG') },
  decideLeave: { who: 'HR', valid: ([id, ok]) => str(id) && bool(ok), run: (d, c, [id, ok]) => engine.decideLeave(d, c, id as string, ok as boolean) },
  revertLeave: { who: 'HR', valid: ([id]) => str(id), run: (d, c, [id]) => engine.revertLeave(d, c, id as string) },
  decideLeaveCancellation: { who: 'HR', valid: ([id, ok]) => str(id) && bool(ok), run: (d, c, [id, ok]) => engine.decideLeaveCancellation(d, c, id as string, ok as boolean) },
  offerOvertime: {
    who: 'HR', valid: ([ids, input]) => Array.isArray(ids) && ids.length <= 50 && ids.every(str) && otInput(input),
    run: (d, c, [ids, input]) => engine.offerOvertime(d, c, ids as string[], input as { date: string; hours: number; note: string }),
  },
  revertOvertime: { who: 'HR', valid: ([id]) => str(id), run: (d, c, [id]) => engine.revertOvertime(d, c, id as string) },
  decideOvertimeCancellation: { who: 'HR', valid: ([id, ok]) => str(id) && bool(ok), run: (d, c, [id, ok]) => engine.decideOvertimeCancellation(d, c, id as string, ok as boolean) },
  payMonth: { who: 'HR', valid: ([m]) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m), run: (d, c, [m]) => engine.payMonth(d, c, m as string) },
  markNotificationsRead: { who: 'HR', valid: () => true, run: (d) => engine.markNotificationsRead(d) },
  resetDemo: { who: 'HR', valid: () => true, run: (_d, c) => engine.freshData(c) },
  simulateEvent: {
    who: 'HR', valid: ([id, kind]) => str(id) && (kind === 'LATE' || kind === 'ABSENT'),
    run: (d, c, [id, kind]) => engine.simulateEvent(d, c, id as string, kind as 'LATE' | 'ABSENT'),
  },

  // ---- Employee (always for the signed-in employee) ----
  submitLeave: {
    who: 'EMPLOYEE', valid: ([input]) => leaveInput(input),
    run: (d, c, [input], me) => {
      const i = input as { type: LeaveType; startDate: string; endDate: string; reason: string };
      return engine.submitLeave(d, c, me, i, keywordClassify(i.type, i.reason), true);
    },
  },
  editLeave: {
    who: 'EMPLOYEE', owned: 'leave', valid: ([id, input]) => str(id) && leaveInput(input),
    run: (d, c, [id, input]) => {
      const i = input as { type: LeaveType; startDate: string; endDate: string; reason: string };
      return engine.editLeave(d, c, id as string, i, keywordClassify(i.type, i.reason));
    },
  },
  withdrawLeave: { who: 'EMPLOYEE', owned: 'leave', valid: ([id]) => str(id), run: (d, c, [id]) => engine.withdrawLeave(d, c, id as string) },
  requestLeaveCancellation: { who: 'EMPLOYEE', owned: 'leave', valid: ([id]) => str(id), run: (d, c, [id]) => engine.requestLeaveCancellation(d, c, id as string) },
  requestOvertime: { who: 'EMPLOYEE', valid: ([input]) => otInput(input), run: (d, c, [input], me) => engine.requestOvertime(d, c, me, input as { date: string; hours: number; note: string }) },
  editOvertime: { who: 'EMPLOYEE', owned: 'overtime', valid: ([id, input]) => str(id) && otInput(input), run: (d, c, [id, input]) => engine.editOvertime(d, c, id as string, input as { date: string; hours: number; note: string }) },
  withdrawOvertime: { who: 'EMPLOYEE', owned: 'overtime', valid: ([id]) => str(id), run: (d, c, [id]) => engine.withdrawOvertime(d, c, id as string) },
  requestOvertimeCancellation: { who: 'EMPLOYEE', owned: 'overtime', valid: ([id]) => str(id), run: (d, c, [id]) => engine.requestOvertimeCancellation(d, c, id as string) },

  // HR approves/rejects requests; the employee accepts/declines offers and marks their own overtime done.
  moveOvertime: {
    who: ([, to]) => (to === 'APPROVED' || to === 'REJECTED' ? 'HR' : 'EMPLOYEE'), owned: 'overtime',
    valid: ([id, to]) => str(id) && OT_MOVES.includes(to as OtMove),
    run: (d, c, [id, to]) => engine.moveOvertime(d, c, id as string, to as OtMove),
  },
};

export class Refused extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403) {
    super(message);
  }
}

export interface Step {
  action: unknown;
  args: unknown;
}

/**
 * Runs a tab's queued actions in the order they were made. Stops at the first refusal: what came before it is kept,
 * what came after is not run (it was built on the refused one). Returns the data plus the refusal, if any.
 */
export function performAll(d: Data, account: Account | null, steps: Step[], now: string): { data: Data; refused?: { action: string; error: Error } } {
  let data = d;
  for (const step of steps) {
    const action = typeof step.action === 'string' ? step.action : '';
    try {
      data = perform(data, account, action, step.args, now);
    } catch (error) {
      return { data, refused: { action, error: error as Error } };
    }
  }
  return { data };
}

/** Checks the action against the signed-in account, then runs it. Throws Refused (no change) or the engine's own error. */
export function perform(d: Data, account: Account | null, name: string, args: unknown, now: string): Data {
  const rule = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
  if (!rule || !Array.isArray(args) || !rule.valid(args)) throw new Refused('That request is not valid.', 400);
  if (!account) throw new Refused('Please sign in again.', 401);
  const who = typeof rule.who === 'function' ? rule.who(args) : rule.who;
  if (account.role !== who) throw new Refused(who === 'HR' ? 'Only HR can do this.' : 'Only the employee can do this.', 403);
  const me = account.employeeId ?? '';
  if (who === 'EMPLOYEE' && rule.owned) {
    const list = rule.owned === 'leave' ? d.leaves : d.overtime;
    const item = list.find((x) => x.id === args[0]);
    if (!item || item.employeeId !== me) throw new Refused('You can only change your own requests.', 403);
  }
  return rule.run(d, { actor: account.role === 'HR' ? `HR: ${account.name}` : account.name, now }, args, me);
}
