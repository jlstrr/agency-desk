import 'server-only';
import { createHash } from 'node:crypto';
import { isConfigured, list } from './infloww';
import { cents, dayMs, earnings, isoDay, numeric, ratio, reportPeriod, sumAvailable, timeWindows, type Transaction } from './metrics';
import type { DashboardData, Days } from './types';

const platformCode = 'OnlyFans';
const rowKey = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 20);
const linkTypes = { TRACKING: 'Tracking', TRIAL: 'Free trial', CAMPAIGN: 'Promotion' } as const;

interface Creator { id: string; platformPid: string; name: string; userName: string; nickName: string }
interface Employee { employeeId: string; employeeName: string }
interface FanSnapshot { platformPid: string; date: string; activeFans: string }
interface SubscriberStats { platformPid: string; date: string; newSubscribers: string }
interface Sale { employeeId: string; salesAmount: number; currency: string }
interface Chat {
  employeeId: string;
  directMessagesSent: number;
  directPpvsSent: number;
  ppvsUnlocked: number;
  fansChatted: number;
}
interface Link {
  id: string;
  name?: string;
  message?: string;
  clickCount?: number;
  subCount?: number;
  earningsNet?: number;
  currency: string;
}

function groups<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const group = grouped.get(id);
    if (group) group.push(item);
    else grouped.set(id, [item]);
  }
  return grouped;
}

async function dailyReport<T>(path: string, ids: string[], param: 'creatorIds' | 'employeeIds', start: number, end: number) {
  const requests = [];
  for (let index = 0; index < ids.length; index += 10) {
    const batch = ids.slice(index, index + 10).join(',');
    for (const range of timeWindows(start, end)) {
      requests.push(list<T>(path, {
        platformCode,
        [param]: batch,
        startTime: isoDay(range.start),
        endTime: isoDay(range.end),
      }));
    }
  }
  return (await Promise.all(requests)).flat();
}

async function transactions(creator: Creator, start: number, end: number) {
  const rows = await Promise.all(timeWindows(start, end).map(range => list<Transaction>('/transactions', {
    platformCode, creatorId: creator.id, startTime: range.start, endTime: range.end,
  }, true)));
  return earnings(rows.flat(), start, end);
}

async function promotions(creator: Creator, start: number, end: number) {
  return (await Promise.all(Object.entries(linkTypes).map(async ([linkType, type]) => {
    const parts = await Promise.all(timeWindows(start, end).map(range => list<Link>('/links', {
      platformCode, creatorId: creator.id, linkType, startTime: range.start, endTime: range.end,
    }, true)));
    const unique = new Map(parts.flat().map(row => [row.id, row]));
    return Array.from(unique.values(), row => ({
      id: rowKey(`${creator.id}:${linkType}:${row.id}`),
      name: row.name || row.message || 'Unnamed link',
      creator: creator.name || creator.nickName || creator.userName,
      type,
      clicks: row.clickCount == null ? null : numeric(row.clickCount),
      subscribers: row.subCount == null ? null : numeric(row.subCount),
      revenue: row.earningsNet == null ? null : cents(row.earningsNet, row.currency) / 100,
    }));
  }))).flat();
}

function byAmount<T>(measure: (item: T) => number | null) {
  return (a: T, b: T) => (measure(b) ?? -Infinity) - (measure(a) ?? -Infinity) || 0;
}

async function collect(days: Days, now: number): Promise<DashboardData> {
  const { start, endExclusive, previousStart } = reportPeriod(days, now);
  const end = isoDay(endExclusive - 1);
  const issues = new Map<string, string>();
  const result: DashboardData = {
    days, start: isoDay(start), end, fetchedAt: new Date(now).toISOString(), issues: [],
    revenue: null, previousRevenue: null, subscribers: null, activeFans: null, chatterSales: null,
    series: [], revenueMix: [], creators: [], chatters: [], promotions: [],
  };
  if (!isConfigured()) {
    result.issues.push({ section: 'Connection', message: 'Set the Infloww API key and agency OID in .env.local.' });
    return result;
  }
  async function load<T>(section: string, operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('Infloww returned HTTP')
        ? error.message
        : 'Infloww data could not be loaded or validated.';
      issues.set(section, message);
      return null;
    }
  }

  async function creatorMetrics() {
    const creators = await load('Creators', () => list<Creator>('/creators', { platformCode }, true));
    if (!creators) return;
    const ids = creators.map(row => row.id);
    const [current, prior, fanRows, subscriberRows, linkRows] = await Promise.all([
      Promise.all(creators.map(creator => load('Earnings', () => transactions(creator, start, endExclusive)))),
      Promise.all(creators.map(creator => load('Prior earnings', () => transactions(creator, previousStart, start)))),
      load('Audience', async () => {
        const rows = await dailyReport<FanSnapshot>('/creator-report/fans/count', ids, 'creatorIds', endExclusive - dayMs, endExclusive);
        return new Map(rows.filter(row => row.date === end).map(row => [String(row.platformPid), numeric(row.activeFans)]));
      }),
      load('Audience', async () => {
        const rows = await dailyReport<SubscriberStats>('/creator-report/fans/subscriber-count', ids, 'creatorIds', start, endExclusive);
        return new Map(Array.from(groups(rows, row => String(row.platformPid)), ([id, group]) => [
          id, group.reduce((sum, row) => sum + numeric(row.newSubscribers), 0),
        ]));
      }),
      Promise.all(creators.map(creator => load('Promotions', () => promotions(creator, start, endExclusive)))),
    ]);
    result.creators = creators.map((creator, index) => {
      const net = current[index]?.total;
      return {
        id: rowKey(creator.id),
        name: creator.name || creator.nickName || creator.userName || 'Unnamed creator',
        handle: creator.userName,
        revenue: net === undefined ? null : net / 100,
        subscribers: subscriberRows?.get(String(creator.platformPid)) ?? null,
        activeFans: fanRows?.get(String(creator.platformPid)) ?? null,
      };
    }).sort(byAmount(row => row.revenue));
    result.subscribers = sumAvailable(result.creators.map(row => row.subscribers));
    result.activeFans = sumAvailable(result.creators.map(row => row.activeFans));
    if (result.activeFans === null && fanRows) issues.set('Audience', 'An end-of-period fan snapshot is missing for at least one creator.');
    if (result.subscribers === null && subscriberRows) issues.set('Audience', 'A subscriber report is missing for at least one creator.');
    const net = sumAvailable(current.map(row => row?.total ?? null));
    const previousNet = sumAvailable(prior.map(row => row?.total ?? null));
    result.revenue = net === null ? null : net / 100;
    result.previousRevenue = previousNet === null ? null : previousNet / 100;
    if (net !== null) {
      const mix = new Map<string, number>();
      for (const row of current) {
        for (const [label, value] of row!.types) mix.set(label, (mix.get(label) ?? 0) + value);
      }
      result.revenueMix = Array.from(mix, ([label, value]) => ({ label, revenue: value / 100 })).sort(byAmount(row => row.revenue));
      result.series = Array.from({ length: days }, (_, index) => {
        const date = isoDay(start + index * dayMs);
        return { date, revenue: current.reduce((sum, row) => sum + (row!.daily.get(date) ?? 0), 0) / 100 };
      });
    }
    result.promotions = linkRows.flatMap(rows => rows ?? []).sort(byAmount(row => row.revenue));
  }

  async function chatterMetrics() {
    const employees = await load('Chatters', () => list<Employee>('/employees', {}, true));
    if (!employees) return;
    const ids = employees.map(row => row.employeeId);
    const [sales, chats] = await Promise.all([
      load('Chatters', async () => {
        const rows = await dailyReport<Sale>('/employee-report/employee-sales-summary', ids, 'employeeIds', start, endExclusive);
        return new Map(Array.from(groups(rows, row => String(row.employeeId)), ([id, group]) => [
          id, group.reduce((sum, row) => sum + cents(row.salesAmount, row.currency), 0),
        ]));
      }),
      load('Chatters', async () => {
        const rows = await dailyReport<Chat>('/employee-report/employee-chat-summary', ids, 'employeeIds', start, endExclusive);
        return new Map(Array.from(groups(rows, row => String(row.employeeId)), ([id, group]) => [
          id, group.reduce((sum, row) => ({
            messages: sum.messages + numeric(row.directMessagesSent),
            fans: sum.fans + numeric(row.fansChatted),
            ppvSent: sum.ppvSent + numeric(row.directPpvsSent),
            unlocks: sum.unlocks + numeric(row.ppvsUnlocked),
          }), { messages: 0, fans: 0, ppvSent: 0, unlocks: 0 }),
        ]));
      }),
    ]);
    result.chatterSales = sales ? Array.from(sales.values()).reduce((sum, amount) => sum + amount, 0) / 100 : null;
    result.chatters = employees.filter(employee => sales?.has(employee.employeeId) || chats?.has(employee.employeeId)).map(employee => {
      const chat = chats?.get(employee.employeeId);
      return {
        id: rowKey(employee.employeeId),
        name: employee.employeeName || 'Unnamed employee',
        sales: sales ? (sales.get(employee.employeeId) ?? 0) / 100 : null,
        messages: chats ? chat?.messages ?? 0 : null,
        fans: chats ? chat?.fans ?? 0 : null,
        unlockRate: chat ? ratio(chat.unlocks, chat.ppvSent) : null,
      };
    }).sort(byAmount(row => row.sales));
  }

  await Promise.all([creatorMetrics(), chatterMetrics()]);
  result.issues = Array.from(issues, ([section, message]) => ({ section, message })).sort((a, b) => a.section.localeCompare(b.section));
  return result;
}

const cache = new Map<Days, { date: string; expires: number; promise: Promise<DashboardData> }>();

export function getDashboard(days: Days) {
  const now = Date.now();
  const date = isoDay(now);
  const cached = cache.get(days);
  if (cached && cached.date === date && cached.expires > now) return cached.promise;
  const entry = { date, expires: Infinity, promise: collect(days, now) };
  cache.set(days, entry);
  void entry.promise.then(data => {
    entry.expires = Date.now() + (data.issues.length ? 20_000 : 120_000);
  }, () => {
    if (cache.get(days) === entry) cache.delete(days);
  });
  return entry.promise;
}

export function invalidateDashboard(days: Days) {
  const entry = cache.get(days);
  if (entry && entry.expires !== Infinity) cache.delete(days);
}
