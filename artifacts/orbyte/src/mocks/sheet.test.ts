import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import * as engine from './engine.ts';
import { DEFAULT_SCENARIO } from './fixtures.ts';
import { buildScenario, parseCsv, SheetError, type SheetTab } from './sheet.ts';
import { SHEET_TEMPLATE, toCsv } from './sheetTemplate.ts';

beforeEach(() => engine.loadScenario(DEFAULT_SCENARIO));

const csvFrom = (edit?: (t: Record<SheetTab, string[][]>) => void) => {
  const tabs = structuredClone(SHEET_TEMPLATE);
  edit?.(tabs);
  return { settings: toCsv(tabs.settings), invoices: toCsv(tabs.invoices), bills: toCsv(tabs.bills), orders: toCsv(tabs.orders) };
};
const setSetting = (tabs: Record<SheetTab, string[][]>, name: string, value: string) => {
  tabs.settings.find((row) => row[0] === name)![1] = value;
};

test('CSV: quotes, commas and line breaks inside cells', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""\nthere"\r\n1,2,3'), [['a', 'b, c', 'say "hi"\nthere'], ['1', '2', '3']]);
});

test('the sheet template gives exactly the built-in numbers', () => {
  engine.loadScenario(buildScenario(csvFrom()));
  const s = engine.getSummary();
  assert.equal(s.breakdown.projectedAfterPayroll, -8400);
  assert.equal(s.status, 'SHORTFALL');
  assert.equal(s.companyName, 'Kopi Kawan Trading Sdn Bhd');
  assert.deepEqual(engine.getActions().map((a) => [a.type, a.expectedImpact]), [['CHASE_RECEIVABLE', 7180], ['RESCHEDULE_BILL', 2600], ['HOLD_PURCHASE', 1200]]);
  assert.equal(engine.getWorkspace().users.OWNER.initials, 'RH');
});

test('changing the sheet changes the demo: more cash in the bank → SAFE, explanation follows', () => {
  engine.loadScenario(buildScenario(csvFrom((t) => {
    setSetting(t, 'Bank balance', 'RM 20,000.00');
    setSetting(t, 'AI explanation', '');
  })));
  const s = engine.getSummary();
  assert.equal(s.breakdown.projectedAfterPayroll, -8400 + 12600);
  assert.equal(s.status, 'SAFE');
  assert.ok(s.ai.explanation.includes('is covered'));
});

test('new rows work: a second movable bill joins the reschedule action', () => {
  engine.loadScenario(buildScenario(csvFrom((t) => {
    t.bills.push(['BILL-400', 'Gula Manis Sdn Bhd', 'Sugar', '800', '24/10/2026', '30 Oct 2026', 'Net 14 terms', '']);
  })));
  const move = engine.getActions().find((a) => a.type === 'RESCHEDULE_BILL')!;
  assert.deepEqual(move.relatedIds, ['BILL-311', 'BILL-400']);
  assert.equal(move.expectedImpact, 3400);
  assert.equal(move.title, 'Move 2 bills to after payday');
});

test('friendly formats: RM amounts, day-first dates, plain percentages, ya/tidak', () => {
  const sc = buildScenario(csvFrom((t) => {
    t.invoices[1] = ['INV-1021', 'Restoran Seri Melaka', 'Encik Faizal', 'RM 4,500.00', '30/09/2026', '0.9', 'whatsapp', '', ''];
    t.orders[1] = ['PO-077', 'PackRight', 'Packaging', '1,200', '22 Oct 2026', 'tidak', '27/10/2026'];
  }));
  assert.deepEqual([sc.receivables[0].amount, sc.receivables[0].dueDate, sc.receivables[0].likelihood], [4500, '2026-09-30', 0.9]);
  assert.deepEqual([sc.purchaseOrders[0].urgent, sc.purchaseOrders[0].dueDate, sc.purchaseOrders[0].suggestedDate], [false, '2026-10-22', '2026-10-27']);
});

test('mistakes name the tab, row and column', () => {
  assert.throws(() => buildScenario(csvFrom((t) => { t.invoices[2][3] = 'tiga ribu'; })), (e) => e instanceof SheetError && e.message === 'Invoices tab, row 3: "Amount" must be an amount like 2600 or RM 2,600.00 (found "tiga ribu").');
  assert.throws(() => buildScenario(csvFrom((t) => { t.bills[1][4] = '31/02/2026'; })), (e) => e instanceof SheetError && e.message.startsWith('Bills tab, row 2: "Due date"'));
  assert.throws(() => buildScenario(csvFrom((t) => { t.settings = t.settings.filter((r) => r[0] !== 'Bank balance'); })), (e) => e instanceof SheetError && e.message.includes('"Bank balance" is missing'));
  assert.throws(() => buildScenario(csvFrom((t) => { t.invoices.push([...t.invoices[1]]); })), (e) => e instanceof SheetError && e.message.includes('used twice'));
});

test('a saved demo is only restored for the same data', () => {
  const saved = engine.exportState();
  engine.loadScenario(buildScenario(csvFrom((t) => setSetting(t, 'Bank balance', '9999'))));
  assert.equal(engine.importState(saved), false);
  engine.loadScenario(DEFAULT_SCENARIO);
  assert.equal(engine.importState(saved), true);
});
