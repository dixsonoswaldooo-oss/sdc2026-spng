import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import { keywordClassify } from './leaveClassifier';

const hr: engine.Ctx = { actor: 'HR: Nur Farah Hanim', now: '2026-10-23T02:00:00.000Z' };
const as = (name: string): engine.Ctx => ({ actor: name, now: '2026-10-23T03:00:00.000Z' });
const net = (d: engine.Data, id: string) => engine.payrollFor(d, id, '2026-10').netPay;

describe('fresh demo data', () => {
  it('sends a WhatsApp for every starting deduction and logs the load', () => {
    const d = engine.freshData(hr);
    // Ravi: 3 late days; Siti: 1 absence; Daniel and Nurul: absent on the day of their pending leave
    expect(d.whatsapp.filter((m) => m.kind === 'DEDUCTION')).toHaveLength(6);
    expect(d.activity.at(-1)!.action).toBe('Loaded demo data');
  });
});

describe('demo scenarios from the spec', () => {
  it('2. raising the late rate recalculates, sends "Update" messages and logs it', () => {
    const d0 = engine.freshData(hr);
    const before = net(d0, 'E3');
    const d1 = engine.updateConfig(d0, hr, { ...d0.config, lateRatePerMinute: 1 });
    expect(net(d1, 'E3')).toBe(before - 12.5); // 25 chargeable minutes, now RM 1 instead of RM 0.50
    expect(d1.whatsapp.filter((m) => m.kind === 'DEDUCTION_UPDATE' && m.employeeId === 'E3')).toHaveLength(3);
    expect(d1.activity.some((a) => a.kind === 'CONFIG' && a.detail.includes('late deduction rate RM 0.50/min → RM 1.00/min'))).toBe(true);
    expect(d1.activity.some((a) => a.kind === 'RECALC' && a.target === 'Ravi Kumar')).toBe(true);
    // Nobody else's amounts changed, so nobody else gets an update
    expect(d1.whatsapp.filter((m) => m.kind === 'DEDUCTION_UPDATE' && m.employeeId !== 'E3')).toHaveLength(0);
  });

  it('3–4. concert leave is labelled Deducted; HR changes it to Tolerated and approves → no cut, label change logged', () => {
    const d0 = engine.freshData(hr);
    const full = net(d0, 'E1');
    const d1 = engine.submitLeave(d0, as('Ahmad Faiz'), 'E1', { type: 'LEAVE', startDate: '2026-10-29', endDate: '2026-10-29', reason: 'mau nonton konser' }, keywordClassify('LEAVE', 'mau nonton konser'));
    const leave = d1.leaves[0];
    expect(leave.label).toBe('DIPOTONG');
    const d2 = engine.setLeaveLabel(d1, hr, leave.id, 'DITOLERANSI');
    const d3 = engine.decideLeave(d2, hr, leave.id, true);
    expect(net(d3, 'E1')).toBe(full);
    expect(d3.leaves[0].labelSource).toBe('HR');
    expect(d3.activity.some((a) => a.action === 'Changed leave label' && a.detail === 'Deducted (Fallback) → Tolerated')).toBe(true);
    // Approved as Deducted instead → one day of daily wage is cut
    const d4 = engine.decideLeave(d1, hr, leave.id, true);
    expect(net(d4, 'E1')).toBe(full - 145.45); // 3,200 / 22
  });

  it('a late AI answer replaces the keyword label, but never HR\'s label or a decided request', () => {
    const reason = 'Anak saya masuk wad, perlu temankan';
    const d1 = engine.submitLeave(engine.freshData(hr), as('Ahmad Faiz'), 'E1', { type: 'LEAVE', startDate: '2026-10-29', endDate: '2026-10-29', reason }, keywordClassify('LEAVE', reason));
    const id = d1.leaves[0].id;
    expect([d1.leaves[0].label, d1.leaves[0].labelSource]).toEqual(['DIPOTONG', 'Fallback']); // "wad" is not a keyword
    const ai = { label: 'DITOLERANSI', alasan: 'A child in hospital needs a parent.', keyakinan: 0.9, source: 'AI' } as const;

    const late = engine.applyAiLabel(d1, as('Ahmad Faiz'), id, ai).leaves[0];
    expect([late.label, late.labelSource, late.confidence]).toEqual(['DITOLERANSI', 'AI', 0.9]);

    const byHr = engine.setLeaveLabel(d1, hr, id, 'DITOLERANSI');
    const afterHr = engine.applyAiLabel(byHr, hr, id, { ...ai, label: 'DIPOTONG' }).leaves[0];
    expect([afterHr.label, afterHr.labelSource]).toEqual(['DITOLERANSI', 'HR']);
    const decided = engine.decideLeave(d1, hr, id, false);
    expect(engine.applyAiLabel(decided, hr, id, ai).leaves[0].labelSource).toBe('Fallback');
  });

  it('5. employee asks for 3 h overtime → HR approves → done → pay goes up', () => {
    const d0 = engine.freshData(hr);
    const before = net(d0, 'E4');
    const d1 = engine.requestOvertime(d0, as('Siti Aminah'), 'E4', { date: '2026-10-28', hours: 3, note: 'Stock count' });
    const id = d1.overtime[0].id;
    const d2 = engine.moveOvertime(d1, hr, id, 'APPROVED');
    expect(net(d2, 'E4')).toBe(before); // approved is not paid yet
    const d3 = engine.moveOvertime(d2, as('Siti Aminah'), id, 'COMPLETED');
    expect(net(d3, 'E4')).toBe(before + 54);
  });

  it('6. HR offers overtime → employee accepts → done → paid; the offer goes out by WhatsApp', () => {
    const d0 = engine.freshData(hr);
    const before = net(d0, 'E1');
    const d1 = engine.offerOvertime(d0, hr, ['E1', 'E2'], { date: '2026-10-29', hours: 2, note: 'Weekend market stall prep.' });
    expect(d1.whatsapp.filter((m) => m.kind === 'OVERTIME_OFFER')).toHaveLength(2);
    const offer = d1.overtime.find((o) => o.employeeId === 'E1' && o.status === 'OFFERED')!;
    const d2 = engine.moveOvertime(d1, as('Ahmad Faiz'), offer.id, 'ACCEPTED');
    expect(() => engine.moveOvertime(d2, hr, offer.id, 'APPROVED')).toThrow(); // offers are accepted, not approved
    const d3 = engine.moveOvertime(d2, as('Ahmad Faiz'), offer.id, 'COMPLETED');
    expect(net(d3, 'E1')).toBe(before + 36);
  });

  it('7. paying October freezes it: snapshot, references, no second payment, no new requests', () => {
    const d0 = engine.freshData(hr);
    const d1 = engine.payMonth(d0, hr, '2026-10');
    const run = d1.payments[0];
    expect(run.month).toBe('2026-10');
    expect(run.paidBy).toBe('Nur Farah Hanim');
    expect(run.lines.map((l) => l.reference)).toEqual(['PAY-202610-001', 'PAY-202610-002', 'PAY-202610-003', 'PAY-202610-004', 'PAY-202610-005', 'PAY-202610-006']);
    const frozen = net(d1, 'E3');
    const d2 = engine.updateConfig(d1, hr, { ...d1.config, lateRatePerMinute: 5 });
    expect(net(d2, 'E3')).toBe(frozen);
    expect(() => engine.payMonth(d2, hr, '2026-10')).toThrow(/already been paid/);
    expect(() => engine.requestOvertime(d2, as('Siti Aminah'), 'E4', { date: '2026-10-28', hours: 2, note: 'x' })).toThrow(/locked/);
  });

  it('8. payment history keeps September and October apart', () => {
    const d = engine.payMonth(engine.freshData(hr), hr, '2026-10');
    expect(d.payments.map((p) => p.month)).toEqual(['2026-10', '2026-09']);
  });
});

describe('WhatsApp only when something changes', () => {
  it('approving a tolerated leave removes the absence and says so', () => {
    const d0 = engine.freshData(hr);
    const d1 = engine.decideLeave(d0, hr, 'LV-1', true); // Daniel, tolerated
    const removal = d1.whatsapp.find((m) => m.employeeId === 'E5' && m.kind === 'DEDUCTION_UPDATE')!;
    expect(removal.text).toMatch(/absence deduction for 27 Oct .* has been removed/);
  });

  it('saving the same settings sends nothing', () => {
    const d0 = engine.freshData(hr);
    const d1 = engine.updateConfig(d0, hr, { ...d0.config });
    expect(d1.whatsapp).toHaveLength(d0.whatsapp.length);
  });
});
