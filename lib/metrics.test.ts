import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earnings, isoDay, ratio, reportPeriod, sumAvailable, timeWindows, type Transaction } from './metrics';

test('selected and prior reporting periods contain equal numbers of complete UTC days', () => {
  const { start, endExclusive, previousStart } = reportPeriod(7, Date.parse('2026-03-02T17:00:00Z'));
  assert.deepEqual([start, endExclusive, previousStart].map(isoDay), ['2026-02-23', '2026-03-02', '2026-02-16']);
  assert.equal(endExclusive - start, start - previousStart);
});

test('a 90-day selection is fetched without overlapping or missing dates', () => {
  const { start, endExclusive } = reportPeriod(90, Date.parse('2026-07-01T09:00:00Z'));
  assert.deepEqual(timeWindows(start, endExclusive).map(window => [isoDay(window.start), isoDay(window.end)]), [
    ['2026-04-02', '2026-05-01'], ['2026-05-02', '2026-05-31'], ['2026-06-01', '2026-06-30'],
  ]);
});

test('settled amounts reconcile across the trend and mix while duplicates, pending sales and adjacent periods are excluded', () => {
  const base: Transaction = { id: 'a', createdTime: '2026-03-01T00:00:00Z', type: 'Tips', status: 'done', net: '325', currency: 'USD' };
  const result = earnings([
    base, base,
    { ...base, id: 'b', createdTime: String(Date.parse('2026-03-02T00:00:00Z')), net: '675', type: 'Messages' },
    { ...base, id: 'pending', status: 'loading', net: '9900' },
    { ...base, id: 'next', createdTime: '2026-03-03T00:00:00Z' },
  ], Date.parse('2026-03-01'), Date.parse('2026-03-03'));
  assert.equal(result.total, 1000);
  assert.deepEqual(Array.from(result.daily), [['2026-03-01', 325], ['2026-03-02', 675]]);
  assert.deepEqual(Array.from(result.types), [['Tips', 325], ['Messages', 675]]);
});

test('a missing metric propagates and zero activity remains a measured zero', () => {
  assert.equal(sumAvailable([10, null]), null);
  assert.equal(sumAvailable([0, 0]), 0);
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(0, 5), 0);
});
