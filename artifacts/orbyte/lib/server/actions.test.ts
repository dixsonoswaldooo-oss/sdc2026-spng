import { describe, expect, it } from 'vitest';
import * as engine from '../engine';
import { ACCOUNTS } from '../seed';
import { perform, performAll, Refused } from './actions';

const NOW = '2026-10-23T02:00:00.000Z'; // 23 Oct in Malaysia
const hr = ACCOUNTS.find((a) => a.role === 'HR')!;
const ahmad = ACCOUNTS.find((a) => a.employeeId === 'E1')!;
const tan = ACCOUNTS.find((a) => a.employeeId === 'E2')!;
const fresh = () => engine.freshData({ actor: 'System', now: NOW });
const refused = (fn: () => unknown, status: number) => {
  try {
    fn();
  } catch (e) {
    return e instanceof Refused && e.status === status;
  }
  return false;
};
const leave = { type: 'LEAVE', startDate: '2026-10-29', endDate: '2026-10-29', reason: 'Family wedding' };

describe('server checks every change against the signed-in account', () => {
  it('HR actions are refused for employees, employee actions for HR, everything without sign-in', () => {
    expect(refused(() => perform(fresh(), ahmad, 'decideLeave', ['LV-1', true], NOW), 403)).toBe(true);
    expect(refused(() => perform(fresh(), ahmad, 'payMonth', ['2026-10'], NOW), 403)).toBe(true);
    expect(refused(() => perform(fresh(), ahmad, 'resetDemo', [], NOW), 403)).toBe(true);
    expect(refused(() => perform(fresh(), ahmad, 'simulateEvent', ['E3', 'LATE'], NOW), 403)).toBe(true);
    expect(refused(() => perform(fresh(), hr, 'simulateEvent', ['E3', 'HOLIDAY'], NOW), 400)).toBe(true);
    expect(refused(() => perform(fresh(), hr, 'submitLeave', [leave], NOW), 403)).toBe(true);
    expect(refused(() => perform(fresh(), null, 'decideLeave', ['LV-1', true], NOW), 401)).toBe(true);
    expect(perform(fresh(), hr, 'decideLeave', ['LV-1', true], NOW).leaves.find((l) => l.id === 'LV-1')!.status).toBe('APPROVED');
  });

  it('an employee request is always filed for the signed-in employee, and the actor comes from the session', () => {
    const d = perform(fresh(), ahmad, 'submitLeave', [leave], NOW);
    expect(d.leaves[0]).toMatchObject({ employeeId: 'E1', status: 'PENDING', aiPending: true });
    expect(d.activity.find((a) => a.action === 'Submitted leave request')!.actor).toBe('Ahmad Faiz');
  });

  it("an employee can't touch someone else's request; overtime moves are split between HR and the owner", () => {
    const d = perform(fresh(), ahmad, 'submitLeave', [leave], NOW);
    const id = d.leaves[0].id;
    expect(refused(() => perform(d, tan, 'withdrawLeave', [id], NOW), 403)).toBe(true);
    expect(perform(d, ahmad, 'withdrawLeave', [id], NOW).leaves[0].status).toBe('WITHDRAWN');
    expect(refused(() => perform(fresh(), tan, 'moveOvertime', ['OT-1', 'APPROVED'], NOW), 403)).toBe(true); // Tan can't approve her own
    const approved = perform(fresh(), hr, 'moveOvertime', ['OT-1', 'APPROVED'], NOW);
    expect(refused(() => perform(approved, ahmad, 'moveOvertime', ['OT-1', 'COMPLETED'], NOW), 403)).toBe(true); // not Ahmad's
    expect(perform(approved, tan, 'moveOvertime', ['OT-1', 'COMPLETED'], NOW).overtime.find((o) => o.id === 'OT-1')!.status).toBe('COMPLETED');
  });

  it('refuses unknown actions and badly shaped input before running anything', () => {
    expect(refused(() => perform(fresh(), hr, 'constructor', [], NOW), 400)).toBe(true);
    expect(refused(() => perform(fresh(), hr, 'decideLeave', ['LV-1', 'yes'], NOW), 400)).toBe(true);
    expect(refused(() => perform(fresh(), ahmad, 'submitLeave', [{ ...leave, type: 'HOLIDAY' }], NOW), 400)).toBe(true);
    expect(refused(() => perform(fresh(), hr, 'updateConfig', [{ overtimeRatePerHour: 'free' }], NOW), 400)).toBe(true);
    expect(refused(() => perform(fresh(), hr, 'decideLeave', 'LV-1', NOW), 400)).toBe(true);
  });

  it('a batch runs in order; a refusal keeps what came before and skips what came after', () => {
    const offered = perform(fresh(), hr, 'offerOvertime', [['E1'], { date: '2026-10-28', hours: 2, note: 'Weekend market' }], NOW);
    const id = offered.overtime[0].id;
    const ok = performAll(offered, ahmad, [{ action: 'moveOvertime', args: [id, 'ACCEPTED'] }, { action: 'moveOvertime', args: [id, 'COMPLETED'] }], NOW);
    expect([ok.refused, ok.data.overtime[0].status]).toEqual([undefined, 'COMPLETED']);

    const partly = performAll(offered, ahmad, [
      { action: 'moveOvertime', args: [id, 'ACCEPTED'] },
      { action: 'decideLeave', args: ['LV-1', true] }, // HR only → refused
      { action: 'moveOvertime', args: [id, 'COMPLETED'] },
    ], NOW);
    expect(partly.refused?.action).toBe('decideLeave');
    expect(partly.data.overtime[0].status).toBe('ACCEPTED');
  });

  it('business rules still come from the engine (e.g. a paid month is locked)', () => {
    const paid = perform(fresh(), hr, 'payMonth', ['2026-10'], NOW);
    expect(() => perform(paid, hr, 'revertLeave', ['LV-1'], NOW)).toThrow(/locked|approved or rejected/);
  });
});
