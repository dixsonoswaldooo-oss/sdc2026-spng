// Salary maths (pure functions, no side effects). Formula from the spec:
//   daily wage   = base salary / working days in the month
//   late cut     = Σ max(0, minutes late − tolerance) × late rate per minute
//   absent cut   = absent days × daily wage × absent %
//   leave cut    = deducted leave days × daily wage × leave %
//   overtime     = Σ hours of COMPLETED overtime × overtime rate per hour
//   gross        = base + bonus + overtime
//   net pay      = gross − late cut − absent cut − leave cut   (never below 0)
// Only attendance-based cuts. No income tax, EPF, SOCSO, EIS or any other statutory deduction.
import { date as fmtDate, money, toSen } from './format';
import type {
  AttendanceRecord, DeductionEvent, Employee, ISODate, LeaveRequest, Month, Overtime, PayrollBreakdown, PayrollConfig,
} from './types';

/** Monday–Friday dates of a month, e.g. workingDays("2026-10") → 22 dates. */
export function workingDays(month: Month): ISODate[] {
  const [y, m] = month.split('-').map(Number);
  const days: ISODate[] = [];
  for (let d = 1; d <= 31; d++) {
    const day = new Date(Date.UTC(y, m - 1, d));
    if (day.getUTCMonth() !== m - 1) break;
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

/** Every date from start to end (inclusive). */
export function datesBetween(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export interface PayrollInput {
  employee: Employee;
  month: Month;
  config: PayrollConfig;
  attendance: AttendanceRecord[]; // this employee's records
  leaves: LeaveRequest[]; // this employee's requests (any status)
  overtime: Overtime[]; // this employee's overtime (any status)
  today?: ISODate; // days from today on have not happened yet: no attendance to judge (omit = the whole month is over)
}

/**
 * Salary for one employee for one month, with every component and each deduction event (for display and WhatsApp).
 * Rules: an APPROVED leave covers its days (the person was on leave): TOLERATED → no cut, not absent; DEDUCTED → leave cut.
 * Any other past working day without a clock-in is absent (no leave, or leave pending/rejected), unless HR marked it izin.
 * Days that have not happened yet are not judged: the result is an estimate until the month is over.
 */
export function computePayroll({ employee, month, config, attendance, leaves, overtime, today }: PayrollInput): PayrollBreakdown {
  const days = workingDays(month);
  const dailyWage = employee.baseSalary / days.length;
  const byDate = new Map(attendance.map((a) => [a.date, a]));
  const approvedLeaveOn = (day: ISODate) =>
    leaves.find((l) => l.status === 'APPROVED' && day >= l.startDate && day <= l.endDate);

  const events: DeductionEvent[] = [];
  for (const day of days) {
    const leave = approvedLeaveOn(day);
    if (leave) {
      if (leave.label === 'DIPOTONG') {
        events.push({
          key: `LEAVE:${day}`, date: day, kind: 'LEAVE', amount: toSen(dailyWage * (config.leaveDeductionPct / 100)),
          explanation: `your leave on ${fmtDate(day, { year: false })} is unpaid (the reason was judged non-essential)`,
        });
      }
      continue;
    }
    if (today && day >= today) continue;
    if (employee.startDate && day < employee.startDate) continue; // before they joined
    const record = byDate.get(day);
    if (record?.izin) continue;
    if (!record?.clockIn) {
      events.push({
        key: `ABSENT:${day}`, date: day, kind: 'ABSENT', amount: toSen(dailyWage * (config.absentDeductionPct / 100)),
        explanation: `you were absent without approved leave on ${fmtDate(day, { year: false })}`,
      });
      continue;
    }
    const excess = Math.max(0, record.lateMinutes - config.lateToleranceMinutes);
    if (excess > 0) {
      events.push({
        key: `LATE:${day}`, date: day, kind: 'LATE', amount: toSen(excess * config.lateRatePerMinute),
        explanation: `you were ${record.lateMinutes} minutes late on ${fmtDate(day, { year: false })} (tolerance ${config.lateToleranceMinutes} minutes)`,
      });
    }
  }

  const sumOf = (kind: DeductionEvent['kind']) => toSen(events.filter((e) => e.kind === kind).reduce((t, e) => t + e.amount, 0));
  const [lateDeduction, absentDeduction, leaveDeduction] = [sumOf('LATE'), sumOf('ABSENT'), sumOf('LEAVE')];
  const overtimeHours = overtime
    .filter((o) => o.status === 'COMPLETED' && o.date.startsWith(month))
    .reduce((t, o) => t + o.hours, 0);
  const overtimePay = toSen(overtimeHours * config.overtimeRatePerHour);
  const baseSalary = toSen(employee.baseSalary);
  const bonus = toSen(employee.bonus);
  const gross = toSen(baseSalary + bonus + overtimePay);
  const totalDeductions = toSen(lateDeduction + absentDeduction + leaveDeduction);
  const rawNet = toSen(gross - totalDeductions);

  return {
    employeeId: employee.id, month, workingDays: days.length, dailyWage: toSen(dailyWage), baseSalary, bonus,
    overtimeHours, overtimePay, gross, lateDeduction, absentDeduction, leaveDeduction, totalDeductions,
    netPay: Math.max(0, rawNet), negativeClamped: rawNet < 0, events,
  };
}

const KIND_WORDS: Record<DeductionEvent['kind'], string> = { LATE: 'late arrival', ABSENT: 'absence', LEAVE: 'unpaid leave' };

/** The WhatsApp text for a deduction event (new, changed or removed). */
export function deductionMessage(name: string, monthLabel: string, event: DeductionEvent, netPay: number, update: boolean): string {
  const first = name.split(' ')[0];
  const net = ` Your estimated take-home pay is now ${money(netPay)}. Please contact HR if anything is wrong.`;
  if (event.amount === 0) {
    return `Update: Hi ${first}, the ${KIND_WORDS[event.kind]} deduction for ${fmtDate(event.date, { year: false })} on your ${monthLabel} salary has been removed.${net}`;
  }
  const lead = update ? `Update: Hi ${first}, a deduction has changed. Your` : `Hi ${first}, your`;
  return `${lead} ${monthLabel} salary has a deduction of ${money(event.amount)} because ${event.explanation}.${net}`;
}
