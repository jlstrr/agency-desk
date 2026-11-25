import type { Days } from './types';

export const dayMs = 86_400_000;
export const isoDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export function reportPeriod(days: Days, now = Date.now()) {
  const endExclusive = Math.floor(now / dayMs) * dayMs;
  const start = endExclusive - days * dayMs;
  return { start, endExclusive, previousStart: start - days * dayMs };
}

export function timeWindows(start: number, endExclusive: number) {
  const ranges: { start: number; end: number }[] = [];
  for (let offset = start; offset < endExclusive; offset += 30 * dayMs) {
    ranges.push({ start: offset, end: Math.min(offset + 30 * dayMs, endExclusive) - 1 });
  }
  return ranges;
}

export function sumAvailable(values: (number | null)[]) {
  return values.some(value => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function numeric(value: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) {
    throw new Error('Missing numeric data');
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Invalid numeric data');
  return number;
}

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export interface Transaction {
  id: string;
  createdTime: string;
  type: string;
  status: string;
  net: string;
  currency: string;
}

export function cents(value: unknown, currency: string) {
  if (currency !== 'USD') throw new Error('Unexpected currency.');
  const amount = numeric(value);
  if (!Number.isSafeInteger(amount)) throw new Error('Invalid monetary amount.');
  return amount;
}

export function earnings(rows: Transaction[], start: number, endExclusive: number) {
  const seen = new Set<string>();
  const daily = new Map<string, number>();
  const types = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    if (row.status !== 'done' || seen.has(row.id)) continue;
    const timestamp = /^\d+$/.test(row.createdTime) ? Number(row.createdTime) : Date.parse(row.createdTime);
    if (!Number.isFinite(timestamp)) throw new Error('Invalid transaction date.');
    if (timestamp < start || timestamp >= endExclusive) continue;
    seen.add(row.id);
    const day = isoDay(timestamp);
    const amount = cents(row.net, row.currency);
    total += amount;
    daily.set(day, (daily.get(day) ?? 0) + amount);
    const type = row.type || 'Other';
    types.set(type, (types.get(type) ?? 0) + amount);
  }
  return { total, daily, types };
}
