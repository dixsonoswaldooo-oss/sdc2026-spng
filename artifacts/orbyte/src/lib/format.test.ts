import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, formatDateTime, formatMoney, formatMoneyShort } from './format.ts';

test('short forms for chart axes and day labels', () => {
  assert.equal(formatDate('2026-10-25', { year: false }), '25 Oct');
  assert.equal(formatMoneyShort(10000), 'RM 10k');
  assert.equal(formatMoneyShort(-8400), '−RM 8.4k');
  assert.equal(formatMoneyShort(500), 'RM 500');
});

test('money: RM, thousands separators, 2 decimals, true minus sign', () => {
  assert.equal(formatMoney(8400), 'RM 8,400.00');
  assert.equal(formatMoney(-8400), '−RM 8,400.00');
  assert.equal(formatMoney(1380, { signed: true }), '+RM 1,380.00');
  assert.equal(formatMoney(0, { signed: true }), 'RM 0.00');
  assert.equal(formatMoney(-0.001), 'RM 0.00');
  assert.equal(formatMoney(1234567.891), 'RM 1,234,567.89');
});

test('dates: "25 Oct 2026" style, "Sep" not "Sept", Malaysia time for date-times', () => {
  assert.equal(formatDate('2026-10-25'), '25 Oct 2026');
  assert.equal(formatDate('2026-09-30'), '30 Sep 2026');
  assert.equal(formatDateTime('2026-10-21T08:00:00+08:00'), '21 Oct, 08:00');
  assert.equal(formatDateTime('2026-10-20T16:30:00Z'), '21 Oct, 00:30');
});
