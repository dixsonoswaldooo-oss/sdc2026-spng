import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import { accountsOf } from './seed';
import { perform, Refused } from './server/actions';

const NOW = '2026-10-23T02:00:00.000Z'; // 23 Oct in Malaysia
const LATER = '2026-10-31T17:00:00.000Z'; // 1 Nov in Malaysia: all of October has happened
const hrCtx: engine.Ctx = { actor: 'HR: Nur Farah Hanim', now: NOW };
const fresh = () => engine.freshData({ actor: 'System', now: NOW });
const worker = { name: 'Aina Sofea', position: 'Barista', division: 'Café floor', baseSalary: 2300, bonus: 100 };
const refusedWith = (fn: () => unknown, status: number) => {
  try {
    fn();
  } catch (e) {
    return e instanceof Refused && e.status === status;
  }
  return false;
};

describe('HR adds a worker', () => {
  it('gets an account at once, starts today and is never absent for days before joining', () => {
    const d = engine.addEmployee(fresh(), hrCtx, worker);
    const aina = d.employees.at(-1)!;
    expect(aina).toMatchObject({ id: 'E7', name: 'Aina Sofea', startDate: '2026-10-23', division: 'Café floor' });
    expect(accountsOf(d.employees).find((a) => a.employeeId === 'E7')).toMatchObject({ id: 'ACC-E7', email: 'aina@kopikawan.my', role: 'EMPLOYEE' });
    expect(d.activity[0]).toMatchObject({ kind: 'PEOPLE', action: 'Added a worker', target: 'Aina Sofea' });
    expect(engine.payrollFor(d, 'E7', '2026-10').events).toHaveLength(0);
    // A week later her days are imported (on time), still no deductions: full base + bonus.
    const later = engine.markNotificationsRead(engine.updateEmployeePay(d, { ...hrCtx, now: LATER }, 'E7', 2300, 100));
    expect(later.attendance.filter((a) => a.employeeId === 'E7').map((a) => a.date)).toEqual(['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    expect(engine.payrollFor(later, 'E7', '2026-10').netPay).toBe(2400);
  });

  it('refuses bad input and duplicate names; a repeated first name gets its own email', () => {
    const d = fresh();
    expect(() => engine.addEmployee(d, hrCtx, { ...worker, name: ' ' })).toThrow(/name/);
    expect(() => engine.addEmployee(d, hrCtx, { ...worker, division: 'Space station' })).toThrow(/department/);
    expect(() => engine.addEmployee(d, hrCtx, { ...worker, baseSalary: -1 })).toThrow(/between/);
    expect(() => engine.addEmployee(d, hrCtx, { ...worker, name: 'ravi kumar' })).toThrow(/already a worker/);
    const two = engine.addEmployee(d, hrCtx, { ...worker, name: 'Ahmad Rizal' });
    expect(accountsOf(two.employees).find((a) => a.employeeId === 'E7')!.email).toBe('ahmad2@kopikawan.my');
  });

  it('only HR may add a worker, and the input is checked on the server', () => {
    const accounts = accountsOf(fresh().employees);
    const hr = accounts[0];
    const ahmad = accounts.find((a) => a.employeeId === 'E1')!;
    expect(refusedWith(() => perform(fresh(), ahmad, 'addEmployee', [worker], NOW), 403)).toBe(true);
    expect(refusedWith(() => perform(fresh(), hr, 'addEmployee', [{ ...worker, baseSalary: '2300' }], NOW), 400)).toBe(true);
    expect(perform(fresh(), hr, 'addEmployee', [worker], NOW).employees).toHaveLength(7);
  });
});

describe('messages: one conversation per worker', () => {
  it('HR writes to a worker, the worker answers in the same conversation', () => {
    const accounts = accountsOf(fresh().employees);
    const [hr, ahmad] = [accounts[0], accounts.find((a) => a.employeeId === 'E1')!];
    const d1 = perform(fresh(), hr, 'sendMessage', ['E1', '  Please bring your MC slip.  '], NOW);
    expect(d1.whatsapp[0]).toMatchObject({ employeeId: 'E1', kind: 'HR_MESSAGE', text: 'Please bring your MC slip.', to: '+60 12-345 1001' });
    const d2 = perform(d1, ahmad, 'replyMessage', ['Noted, thank you.'], NOW);
    expect(d2.whatsapp[0]).toMatchObject({ employeeId: 'E1', kind: 'REPLY', to: 'HR', text: 'Noted, thank you.' });
    expect(d2.activity[0]).toMatchObject({ kind: 'WHATSAPP', action: 'Replied to HR', actor: 'Ahmad Faiz' });
  });

  it('a worker can only answer in their own conversation; empty or long messages are refused', () => {
    const accounts = accountsOf(fresh().employees);
    const [hr, ahmad] = [accounts[0], accounts.find((a) => a.employeeId === 'E1')!];
    expect(refusedWith(() => perform(fresh(), ahmad, 'sendMessage', ['E2', 'hi'], NOW), 403)).toBe(true);
    expect(refusedWith(() => perform(fresh(), hr, 'replyMessage', ['hi'], NOW), 403)).toBe(true);
    expect(refusedWith(() => perform(fresh(), hr, 'sendMessage', ['E1', 'x'.repeat(501)], NOW), 400)).toBe(true);
    expect(() => perform(fresh(), hr, 'sendMessage', ['E1', '   '], NOW)).toThrow(/Write a message/);
    expect(() => perform(fresh(), hr, 'sendMessage', ['E99', 'hi'], NOW)).toThrow(/does not exist/);
  });
});
