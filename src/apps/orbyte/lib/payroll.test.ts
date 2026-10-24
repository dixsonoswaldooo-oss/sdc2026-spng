import { describe, expect, it } from 'vitest';
import { computePayroll, deductionMessage, workingDays } from './payroll';
import { DEFAULT_CONFIG, EMPLOYEES, seedState } from './seed';
import type { LeaveRequest, Overtime } from './types';

const seed = seedState('2026-11-01'); // the whole of October has happened
const OCT = '2026-10';
const byId = (id: string) => EMPLOYEES.find((e) => e.id === id)!;
const pay = (id: string, extra: { leaves?: LeaveRequest[]; overtime?: Overtime[]; config?: Partial<typeof DEFAULT_CONFIG> } = {}) =>
  computePayroll({
    employee: byId(id), month: OCT, config: { ...DEFAULT_CONFIG, ...extra.config },
    attendance: seed.attendance.filter((a) => a.employeeId === id), leaves: extra.leaves ?? [], overtime: extra.overtime ?? [],
  });
const leave = (employeeId: string, day: string, status: LeaveRequest['status'], label: LeaveRequest['label']): LeaveRequest => ({
  id: 'T', employeeId, type: 'LEAVE', startDate: day, endDate: day, reason: 'test', status, label, labelReason: '', confidence: 1, labelSource: 'HR', createdAt: '',
});
const ot = (status: Overtime['status'], hours = 3): Overtime => ({ id: 'O', employeeId: 'E1', date: '2026-10-22', hours, note: '', origin: 'EMPLOYEE', status, createdAt: '' });

describe('working days', () => {
  it('October 2026 has 22 weekdays', () => expect(workingDays(OCT)).toHaveLength(22));
});

describe('computePayroll', () => {
  it('no deductions: perfect attendance takes home base + bonus', () => {
    const p = pay('E1');
    expect(p.totalDeductions).toBe(0);
    expect(p.netPay).toBe(3200 + 250);
  });

  it('late within tolerance is not deducted', () => {
    expect(pay('E2').lateDeduction).toBe(0);
  });

  it('late beyond tolerance: only the minutes past the tolerance are charged', () => {
    const p = pay('E3'); // 25, 18 and 12 minutes late → 15 + 8 + 2 = 25 minutes × RM 0.50
    expect(p.lateDeduction).toBe(12.5);
    expect(p.events.filter((e) => e.kind === 'LATE').map((e) => e.amount)).toEqual([7.5, 4, 1]);
  });

  it('absent: one day of daily wage', () => {
    const p = pay('E4'); // 2,200 / 22 = 100 per day; the 7-minute late day is within tolerance
    expect(p.absentDeduction).toBe(100);
    expect(p.netPay).toBe(2200 + 100 - 100);
  });

  it('approved + tolerated leave: no cut and not counted as absent', () => {
    const p = pay('E5', { leaves: [leave('E5', '2026-10-27', 'APPROVED', 'DITOLERANSI')] });
    expect(p.totalDeductions).toBe(0);
  });

  it('approved + deducted leave: daily wage × leave %', () => {
    const p = pay('E5', { leaves: [leave('E5', '2026-10-27', 'APPROVED', 'DIPOTONG')] });
    expect(p.leaveDeduction).toBe(136.36); // 3,000 / 22
    expect(p.absentDeduction).toBe(0);
    const half = pay('E5', { leaves: [leave('E5', '2026-10-27', 'APPROVED', 'DIPOTONG')], config: { leaveDeductionPct: 50 } });
    expect(half.leaveDeduction).toBe(68.18);
  });

  it('rejected leave and the employee still did not come in: absent', () => {
    const p = pay('E5', { leaves: [leave('E5', '2026-10-27', 'REJECTED', 'DITOLERANSI')] });
    expect(p.absentDeduction).toBe(136.36);
    expect(p.leaveDeduction).toBe(0);
  });

  it('a pending leave does not protect the day yet (no approved leave → absent)', () => {
    expect(pay('E5', { leaves: [leave('E5', '2026-10-27', 'PENDING', 'DITOLERANSI')] }).absentDeduction).toBe(136.36);
  });

  it('overtime: approved but not completed is not paid; completed is paid', () => {
    expect(pay('E1', { overtime: [ot('APPROVED')] }).overtimePay).toBe(0);
    expect(pay('E1', { overtime: [ot('ACCEPTED')] }).overtimePay).toBe(0);
    const done = pay('E1', { overtime: [ot('COMPLETED')] });
    expect(done.overtimePay).toBe(54); // 3 h × RM 18
    expect(done.gross).toBe(3200 + 250 + 54);
  });

  it('take-home pay below zero shows 0 with a warning flag', () => {
    const p = pay('E3', { config: { lateRatePerMinute: 1000 } });
    expect(p.netPay).toBe(0);
    expect(p.negativeClamped).toBe(true);
  });

  it('only attendance deductions: nothing else is taken off (no tax, EPF, SOCSO, EIS)', () => {
    for (const e of EMPLOYEES) {
      const p = pay(e.id);
      expect(p.totalDeductions).toBe(Math.round((p.lateDeduction + p.absentDeduction + p.leaveDeduction) * 100) / 100);
      expect(p.netPay).toBe(Math.max(0, Math.round((p.gross - p.totalDeductions) * 100) / 100));
      expect(p.gross).toBe(p.baseSalary + p.bonus + p.overtimePay);
    }
  });

  it('every component is rounded to the sen', () => {
    const p = pay('E5', { leaves: [leave('E5', '2026-10-27', 'APPROVED', 'DIPOTONG')], config: { leaveDeductionPct: 33 } });
    expect(Number.isInteger(p.leaveDeduction * 100)).toBe(true);
  });
});

describe('WhatsApp text', () => {
  it('explains the cut, the date, the tolerance and the new estimate', () => {
    const p = pay('E3');
    const text = deductionMessage('Ravi Kumar', 'October 2026', p.events[0], p.netPay, false);
    expect(text).toBe('Hi Ravi, your October 2026 salary has a deduction of RM 7.50 because you were 25 minutes late on 14 Oct (tolerance 10 minutes). Your estimated take-home pay is now RM 2,537.50. Please contact HR if anything is wrong.');
  });

  it('says "Update" when an amount changes, and when a deduction is removed', () => {
    const p = pay('E3');
    expect(deductionMessage('Ravi Kumar', 'October 2026', p.events[0], p.netPay, true)).toMatch(/^Update: Hi Ravi, a deduction has changed\./);
    expect(deductionMessage('Ravi Kumar', 'October 2026', { ...p.events[0], amount: 0 }, p.netPay, true)).toMatch(/late arrival deduction for 14 Oct .* has been removed/);
  });
});

describe('seeded September payment', () => {
  it('is paid with PAY-202609-NNN references', () => {
    const sept = seed.payments[0];
    expect(sept.lines.map((l) => l.reference)).toEqual(['PAY-202609-001', 'PAY-202609-002', 'PAY-202609-003', 'PAY-202609-004', 'PAY-202609-005', 'PAY-202609-006']);
    expect(sept.lines.find((l) => l.employeeId === 'E3')!.lateDeduction).toBe(5);
  });
});
