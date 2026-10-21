import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ApiError } from '../api/errors.ts';
import * as engine from './engine.ts';

// Brief §4 expected outcomes (with the agreed PO-077 fix: bank RM 7,400, PO counted as money out).

beforeEach(() => engine.reset());

const idOf = (type: string) => engine.getActions().find((a) => a.type === type)!.id;
const [CHASE, RESCHEDULE, HOLD] = ['CHASE_RECEIVABLE', 'RESCHEDULE_BILL', 'HOLD_PURCHASE'];

test('no actions: SHORTFALL, −8,400 after payroll, breakdown adds up', () => {
  const s = engine.getSummary();
  assert.deepEqual(s.breakdown, {
    currentBalance: 7400, expectedSales: 7600, expectedReceivables: 2800, billsDue: 7000, purchasesDue: 1200,
    balanceBeforePayroll: 9600, projectedAfterPayroll: -8400,
  });
  assert.equal(s.status, 'SHORTFALL');
  assert.equal(s.gapToBuffer, 10400);
  assert.equal(s.daysToPayday, 4);
  assert.equal(s.payday, '2026-10-25');
  assert.equal(s.ai.isFallback, false);
});

test('actions are ranked with the brief impacts', () => {
  const actions = engine.getActions();
  assert.deepEqual(actions.map((a) => [a.id, a.type, a.potentialImpact, a.expectedImpact]), [
    ['ACT-1', CHASE, 9200, 7180],
    ['ACT-2', RESCHEDULE, 2600, 2600],
    ['ACT-3', HOLD, 1200, 1200],
  ]);
  assert.equal(actions[0].drafts?.length, 3);
});

test('what-if: 1+2 → AT_RISK +1,380; 1+2+3 → SAFE +2,580', () => {
  assert.deepEqual(engine.getProjection([idOf(CHASE), idOf(RESCHEDULE)]).withActions, { projectedAfterPayroll: 1380, gapToBuffer: 620, status: 'AT_RISK' });
  assert.deepEqual(engine.getProjection([idOf(CHASE), idOf(RESCHEDULE), idOf(HOLD)]).withActions, { projectedAfterPayroll: 2580, gapToBuffer: 0, status: 'SAFE' });
});

test('chart agrees with the breakdown on payday', () => {
  const { points } = engine.getProjection([idOf(CHASE), idOf(RESCHEDULE), idOf(HOLD)]);
  assert.equal(points[0].date, '2026-10-21');
  assert.equal(points[0].current, 7400);
  assert.equal(points.length, 12); // today to payday + 7
  const payday = points.find((p) => p.date === '2026-10-25')!;
  assert.equal(payday.current, -8400);
  assert.equal(payday.withActions, 2580);
});

test('customers pay + action 2 approved → SAFE +3,400', () => {
  engine.simulatePayments();
  engine.approveAction(idOf(RESCHEDULE), 'OWNER');
  const s = engine.getSummary();
  assert.equal(s.breakdown.projectedAfterPayroll, 3400);
  assert.equal(s.status, 'SAFE');
  assert.ok(s.ai.explanation.includes('is covered'), 'explanation must not still describe the old shortfall');
  assert.equal(engine.getActions().some((a) => a.type === CHASE), false); // nothing left to chase
});

test('approving 1+2 changes the real projection to AT_RISK +1,380 and is logged', () => {
  engine.approveAction(idOf(CHASE), 'OWNER');
  engine.approveAction(idOf(RESCHEDULE), 'OWNER');
  const s = engine.getSummary();
  assert.equal(s.breakdown.projectedAfterPayroll, 1380);
  assert.equal(s.status, 'AT_RISK');
  const kinds = engine.getAudit().map((e) => `${e.kind}:${e.role}`);
  assert.ok(kinds.includes('ACTION_APPROVED:OWNER'));
  assert.ok(kinds.includes('ACTION_EXECUTED:SYSTEM'));
});

test('chasing only some invoices counts only those', () => {
  const chase = engine.getActions()[0];
  engine.approveAction(chase.id, 'OWNER', chase.drafts!.filter((d) => d.receivableId !== 'INV-1031'));
  assert.equal(engine.getSummary().breakdown.projectedAfterPayroll, -8400 + 4050 + 2170);
});

test('roles: Finance Admin cannot approve, reject or change settings; Owner cannot submit', () => {
  const id = idOf(CHASE);
  assert.throws(() => engine.approveAction(id, 'FINANCE_ADMIN'), (e) => e instanceof ApiError && e.status === 403);
  assert.throws(() => engine.rejectAction(id, 'FINANCE_ADMIN', 'no'), (e) => e instanceof ApiError && e.status === 403);
  assert.throws(() => engine.updateSettings('FINANCE_ADMIN', engine.getSettings()), (e) => e instanceof ApiError && e.status === 403);
  assert.throws(() => engine.submitAction(id, 'OWNER'), (e) => e instanceof ApiError && e.status === 403);
  assert.equal(engine.submitAction(id, 'FINANCE_ADMIN').status, 'PENDING_APPROVAL');
  assert.equal(engine.approveAction(id, 'OWNER').status, 'EXECUTED');
});

test('reject needs a reason and is logged with it', () => {
  const id = idOf(HOLD);
  assert.throws(() => engine.rejectAction(id, 'OWNER', '  '), (e) => e instanceof ApiError && e.status === 400);
  engine.rejectAction(id, 'OWNER', 'Need the bags this week');
  const event = engine.getAudit().find((e) => e.kind === 'ACTION_REJECTED')!;
  assert.equal(event.details?.Reason, 'Need the bags this week');
});

test('AI down: fallback explanation and template drafts, nothing blank', () => {
  engine.simulateAiDown();
  const s = engine.getSummary();
  assert.equal(s.ai.isFallback, true);
  assert.ok(s.ai.explanation.includes('−RM 8,400.00'));
  assert.ok(engine.getActions()[0].drafts!.every((d) => d.isFallback && d.body.length > 0));
  assert.equal(engine.regenerateDraft('INV-1021', 'BM', 'OWNER').isFallback, true);
});

test('demo controls work in any order: customers pay, then AI down', () => {
  engine.simulatePayments();
  assert.doesNotThrow(() => engine.simulateAiDown());
  assert.equal(engine.getSummary().ai.isFallback, true);
});

test('regenerate cycles through AI versions per language', () => {
  const first = engine.regenerateDraft('INV-1021', 'BM', 'FINANCE_ADMIN');
  const second = engine.regenerateDraft('INV-1021', 'BM', 'FINANCE_ADMIN');
  assert.notEqual(first.body, second.body);
  assert.ok(first.body.startsWith('Salam Encik Faizal'));
});

test('Owner settings change the status; chased invoices record the contact time', () => {
  engine.updateSettings('OWNER', { ...engine.getSettings(), safetyBuffer: 3000 });
  assert.equal(engine.getProjection([idOf(CHASE), idOf(RESCHEDULE), idOf(HOLD)]).withActions.status, 'AT_RISK'); // 2,580 < 3,000
  engine.approveAction(idOf(CHASE), 'OWNER');
  const chased = engine.getReceivables().filter((r) => r.lastContactAt);
  assert.deepEqual(chased.map((r) => r.id), ['INV-1021', 'INV-1027', 'INV-1031']);
  assert.ok(chased.every((r) => r.countedInProjection && r.reminderStatus === 'SENT'));
});

test('no action ever touches salaries', () => {
  for (const a of engine.getActions()) assert.ok(['CHASE_RECEIVABLE', 'RESCHEDULE_BILL', 'HOLD_PURCHASE'].includes(a.type));
});
