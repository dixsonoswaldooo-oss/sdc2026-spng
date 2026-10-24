import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import { keywordClassify } from './leaveClassifier';

// 23 Oct 2026, 10:00 in Malaysia: days from 23 Oct on have not happened yet.
const hr: engine.Ctx = { actor: 'HR: Nur Farah Hanim', now: '2026-10-23T02:00:00.000Z' };
const as = (name: string): engine.Ctx => ({ actor: name, now: '2026-10-23T03:00:00.000Z' });
const net = (d: engine.Data, id: string) => engine.payrollFor(d, id, '2026-10').netPay;
const fresh = () => engine.freshData(hr);
const leaveInput = (startDate: string, reason = 'Family wedding in Ipoh', type: 'LEAVE' | 'PERMISSION' = 'LEAVE') =>
  ({ type, startDate, endDate: startDate, reason });
const submit = (d: engine.Data, startDate: string, reason?: string) =>
  engine.submitLeave(d, as('Ahmad Faiz'), 'E1', leaveInput(startDate, reason), keywordClassify('LEAVE', reason ?? 'Family wedding in Ipoh'), true);

describe('today (real date, Malaysia time)', () => {
  it('uses the Malaysian date, and days that have not happened are not judged', () => {
    expect(engine.todayOf('2026-10-23T17:00:00.000Z')).toBe('2026-10-24');
    const d = fresh();
    expect(d.today).toBe('2026-10-23');
    expect(d.attendance.some((a) => a.date >= '2026-10-23')).toBe(false);
    const daniel = engine.payrollFor(d, 'E5', '2026-10');
    expect(daniel.events).toHaveLength(0); // his 27 Oct is still to come
    expect(engine.payrollFor(d, 'E3', '2026-10').events.map((e) => e.date)).toEqual(['2026-10-14', '2026-10-21']);
  });
});

describe('1. HR reverts a decision', () => {
  it('leave: back to pending, decision cleared, pay recalculated, revert logged', () => {
    const ctx = { ...hr, now: '2026-10-31T17:00:00.000Z' }; // 1 Nov: Daniel's 27 Oct absence exists
    const start = engine.freshData(ctx);
    const approved = engine.decideLeave(start, ctx, 'LV-1', true);
    expect(net(approved, 'E5')).toBeGreaterThan(net(start, 'E5'));
    const back = engine.revertLeave(approved, ctx, 'LV-1');
    const lv = back.leaves.find((l) => l.id === 'LV-1')!;
    expect([lv.status, lv.decidedAt, lv.decidedBy]).toEqual(['PENDING', undefined, undefined]);
    expect(net(back, 'E5')).toBe(net(start, 'E5'));
    expect(back.activity.some((a) => a.kind === 'REVERT' && a.detail.includes('was Approved by HR: Nur Farah Hanim'))).toBe(true);
  });

  it('is blocked once the month is paid', () => {
    const d = engine.payMonth(engine.decideLeave(fresh(), hr, 'LV-1', true), hr, '2026-10');
    expect(() => engine.revertLeave(d, hr, 'LV-1')).toThrow(/locked/);
    expect(engine.paidReason(d, ['2026-10-27'])).toBe('This period has been paid (October 2026)');
  });

  it('overtime: approved/rejected go back to pending; worked overtime does not', () => {
    const d1 = engine.moveOvertime(fresh(), hr, 'OT-1', 'APPROVED');
    expect(engine.revertOvertime(d1, hr, 'OT-1').overtime.find((o) => o.id === 'OT-1')!.status).toBe('REQUESTED');
    const worked = engine.moveOvertime(d1, as('Tan Mei Ling'), 'OT-1', 'COMPLETED');
    expect(() => engine.revertOvertime(worked, hr, 'OT-1')).toThrow(/worked/);
  });
});

describe('2. leave allowance', () => {
  it('only approved "Leave" days count; the allowance must be a whole number ≥ 0; lower than used is allowed', () => {
    const d1 = engine.decideLeave(engine.decideLeave(fresh(), hr, 'LV-1', true), hr, 'LV-2', true); // LV-2 is "Day off"
    expect(engine.leaveUsed(d1, 'E5')).toBe(1);
    expect(engine.leaveUsed(d1, 'E6')).toBe(0);
    expect(() => engine.updateLeaveAllowance(d1, hr, 'E5', -1)).toThrow(/0 or more/);
    expect(() => engine.updateLeaveAllowance(d1, hr, 'E5', 2.5)).toThrow(/whole number/);
    const d2 = engine.updateLeaveAllowance(d1, hr, 'E5', 0);
    expect(d2.employees.find((e) => e.id === 'E5')!.annualLeaveDays).toBe(0);
    expect(d2.activity.some((a) => a.action === 'Changed annual leave allowance' && a.detail === '14 → 0 days (1 used)')).toBe(true);
  });
});

describe('3. overtime rate per division', () => {
  it('a division override wins over the global default only for that division, and can be reset', () => {
    const d1 = engine.setDivisionOvertime(fresh(), hr, 'Café floor', 25);
    const siti = d1.employees.find((e) => e.id === 'E4')!;
    const tan = d1.employees.find((e) => e.id === 'E2')!;
    expect([engine.overtimeRate(d1, siti), engine.overtimeRate(d1, tan)]).toEqual([25, 18]);
    const d2 = engine.setDivisionOvertime(d1, hr, 'Café floor', null);
    expect(engine.overtimeRate(d2, siti)).toBe(18);
    expect(d2.activity.some((a) => a.action === 'Changed division overtime rate' && a.target === 'Café floor')).toBe(true);
  });
});

describe('6. HR edits attendance', () => {
  it('izin removes an absence on top of the imported data, is logged, and can be reset', () => {
    const d0 = fresh();
    const d1 = engine.setAttendance(d0, hr, 'E4', '2026-10-09', { status: 'IZIN', lateMinutes: 0 });
    expect(net(d1, 'E4')).toBe(net(d0, 'E4') + 100); // 2,200 / 22
    expect(d1.attendance.find((a) => a.employeeId === 'E4' && a.date === '2026-10-09')!.clockIn).toBeUndefined(); // raw kept
    expect(engine.attendanceSummary(d1, 'E4', '2026-10')).toMatchObject({ absent: 0, izin: 1, edited: 1 });
    expect(d1.activity.some((a) => a.kind === 'ATTENDANCE' && a.detail === '2026-10-09: absent → permitted absence')).toBe(true);
    const d2 = engine.setAttendance(d1, hr, 'E4', '2026-10-09', null);
    expect(net(d2, 'E4')).toBe(net(d0, 'E4'));
  });

  it('minutes late change the late cut; future days and paid months are refused', () => {
    const d1 = engine.setAttendance(fresh(), hr, 'E3', '2026-10-14', { status: 'PRESENT', lateMinutes: 40 });
    expect(engine.payrollFor(d1, 'E3', '2026-10').lateDeduction).toBe(15 + 4); // (40−10) and (18−10) minutes × RM 0.50
    expect(() => engine.setAttendance(d1, hr, 'E3', '2026-10-28', { status: 'ABSENT', lateMinutes: 0 })).toThrow(/already happened/);
    expect(() => engine.setAttendance(d1, hr, 'E3', '2026-09-15', { status: 'PRESENT', lateMinutes: 0 })).toThrow(/locked/);
  });
});

describe('demo: simulate an event', () => {
  it('late or absent on the last working day that has passed: deduction, WhatsApp, logged; undo restores it', () => {
    const d0 = fresh();
    expect(engine.lastWorkedDay(d0, 'E3')).toBe('2026-10-22'); // today is 23 Oct
    const late = engine.simulateEvent(d0, hr, 'E3', 'LATE');
    expect(net(late, 'E3')).toBe(net(d0, 'E3') - 7.5); // 25 − 10 minutes tolerance × RM 0.50
    expect(late.whatsapp[0]).toMatchObject({ employeeId: 'E3', kind: 'DEDUCTION' });
    expect(late.whatsapp[0].text).toMatch(/25 minutes late on 22 Oct/);
    expect(late.activity.some((a) => a.action === 'Simulated attendance event (demo)' && a.target === 'Ravi Kumar')).toBe(true);
    expect(net(engine.setAttendance(late, hr, 'E3', '2026-10-22', null), 'E3')).toBe(net(d0, 'E3'));

    const absent = engine.simulateEvent(d0, hr, 'E4', 'ABSENT');
    expect(net(absent, 'E4')).toBe(net(d0, 'E4') - 100); // 2,200 / 22
    expect(() => engine.simulateEvent(engine.payMonth(d0, hr, '2026-10'), hr, 'E3', 'LATE')).toThrow(/locked/);
  });
});

describe('7. requests are saved at once; the AI label comes later', () => {
  it('a pending request exists before the AI answers; an answer for an old reason is ignored', () => {
    const d1 = submit(fresh(), '2026-10-29', 'Anak saya masuk wad');
    const lv = d1.leaves[0];
    expect([lv.status, lv.aiPending, lv.labelSource]).toEqual(['PENDING', true, 'Fallback']);
    const d2 = engine.editLeave(d1, as('Ahmad Faiz'), lv.id, leaveInput('2026-10-30', 'Anak saya masuk wad, perlu temankan'), keywordClassify('LEAVE', 'x'));
    const ai = { label: 'DITOLERANSI', alasan: 'A child in hospital.', keyakinan: 0.9, source: 'AI' } as const;
    expect(engine.applyAiLabel(d2, as('AI'), lv.id, ai, 'Anak saya masuk wad').leaves[0].labelSource).toBe('Fallback'); // stale
    expect(engine.applyAiLabel(d2, as('AI'), lv.id, ai, 'Anak saya masuk wad, perlu temankan').leaves[0].labelSource).toBe('AI');
  });
});

describe('8. employee withdraws, edits and cancels', () => {
  it('withdraw and edit a pending request: kept in history, HR notified', () => {
    const d1 = submit(fresh(), '2026-10-29');
    const id = d1.leaves[0].id;
    const edited = engine.editLeave(d1, as('Ahmad Faiz'), id, leaveInput('2026-10-30'), keywordClassify('LEAVE', 'x'));
    expect(edited.leaves[0]).toMatchObject({ startDate: '2026-10-30', status: 'PENDING', aiPending: true });
    expect(edited.notifications[0]).toMatchObject({ read: false, text: expect.stringMatching(/edited a pending leave/) });
    const withdrawn = engine.withdrawLeave(edited, as('Ahmad Faiz'), id);
    expect(withdrawn.leaves.find((l) => l.id === id)!.status).toBe('WITHDRAWN');
    expect(withdrawn.notifications[0].text).toMatch(/withdrew a pending leave/);
    expect(() => engine.editLeave(withdrawn, as('Ahmad Faiz'), id, leaveInput('2026-10-30'), keywordClassify('LEAVE', 'x'))).toThrow(/still waiting/);
    expect(engine.markNotificationsRead(withdrawn).notifications.every((n) => n.read)).toBe(true);
  });

  it('cancel an approved future leave: HR approves → cancelled, allowance and pay restored; HR rejects → stays', () => {
    const d1 = submit(fresh(), '2026-10-29', 'mau nonton konser'); // keyword label: deducted
    const id = d1.leaves[0].id;
    const approved = engine.decideLeave(d1, hr, id, true);
    expect(engine.leaveUsed(approved, 'E1')).toBe(1);
    const asked = engine.requestLeaveCancellation(approved, as('Ahmad Faiz'), id);
    expect(asked.leaves[0].cancelRequestedAt).toBeDefined();
    const kept = engine.decideLeaveCancellation(asked, hr, id, false);
    expect([kept.leaves[0].status, kept.leaves[0].cancelRequestedAt]).toEqual(['APPROVED', undefined]);
    const cancelled = engine.decideLeaveCancellation(asked, hr, id, true);
    expect(cancelled.leaves[0].status).toBe('CANCELLED');
    expect(engine.leaveUsed(cancelled, 'E1')).toBe(0);
    expect(net(cancelled, 'E1')).toBe(net(d1, 'E1'));
    expect(net(approved, 'E1')).toBe(net(d1, 'E1') - 145.45); // the deducted day while approved
  });

  it('refuses leave already taken, overtime already worked, and anything in a paid month', () => {
    const asked20 = submit(fresh(), '2026-10-20');
    const past = engine.decideLeave(asked20, hr, asked20.leaves[0].id, true);
    expect(engine.leaveCancelBlock(past, past.leaves[0])).toBe('This leave has already been taken');
    expect(() => engine.requestLeaveCancellation(past, as('Ahmad Faiz'), past.leaves[0].id)).toThrow(/already been taken/);

    const ot = engine.moveOvertime(fresh(), hr, 'OT-1', 'APPROVED'); // OT-1 is on 22 Oct
    expect(() => engine.requestOvertimeCancellation(ot, as('Tan Mei Ling'), 'OT-1')).toThrow(/already been worked/);
    const future = engine.requestOvertime(fresh(), as('Siti Aminah'), 'E4', { date: '2026-10-28', hours: 2, note: 'Stock count' });
    const otId = future.overtime[0].id;
    const asked = engine.requestOvertimeCancellation(engine.moveOvertime(future, hr, otId, 'APPROVED'), as('Siti Aminah'), otId);
    expect(engine.decideOvertimeCancellation(asked, hr, otId, true).overtime[0].status).toBe('CANCELLED');

    const paid = engine.payMonth(submit(fresh(), '2026-10-29'), hr, '2026-10');
    expect(() => engine.withdrawLeave(paid, as('Ahmad Faiz'), paid.leaves[0].id)).toThrow(/locked/);
  });
});

describe('saved data from the previous version', () => {
  it('is migrated without losing requests, payments or the log', () => {
    const v2 = fresh();
    const v1 = structuredClone(v2) as Partial<engine.Data> & engine.Data;
    for (const e of v1.employees) {
      delete (e as Partial<typeof e>).division;
      delete (e as Partial<typeof e>).annualLeaveDays;
    }
    delete (v1 as Partial<engine.Data>).attendanceOverrides;
    delete (v1 as Partial<engine.Data>).divisionOvertime;
    delete (v1 as Partial<engine.Data>).notifications;
    delete (v1 as Partial<engine.Data>).version;
    const migrated = engine.migrate(v1, hr);
    expect(migrated.version).toBe(engine.DATA_VERSION);
    expect(migrated.employees.find((e) => e.id === 'E3')).toMatchObject({ division: 'Logistics', annualLeaveDays: 14 });
    expect([migrated.attendanceOverrides, migrated.divisionOvertime, migrated.notifications]).toEqual([{}, {}, []]);
    expect(migrated.leaves).toEqual(v2.leaves);
    expect(migrated.payments).toEqual(v2.payments);
    expect(migrated.activity.some((a) => a.action === 'Updated saved demo data')).toBe(true);
  });
});
