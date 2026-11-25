import 'server-only';

const endpoint = 'https://openapi.infloww.com/v1';
const concurrency = 6;
let active = 0;
let nextRequestAt = 0;
const queue: (() => void)[] = [];

async function withRequestSlot<T>(operation: () => Promise<T>) {
  if (active >= concurrency) await new Promise<void>(resolve => queue.push(resolve));
  else active++;
  try {
    return await operation();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}

type Query = Record<string, string | number>;
type ResponseBody<T> = { data?: { list?: T[] }; hasMore?: boolean; cursor?: string };
export const isConfigured = () => Boolean(process.env.INFLOWW_API_KEY && process.env.INFLOWW_AGENCY_OID);

async function request<T>(path: string, params: Query): Promise<ResponseBody<T>> {
  const key = process.env.INFLOWW_API_KEY;
  const oid = process.env.INFLOWW_AGENCY_OID;
  if (!key || !oid) throw new Error('Infloww credentials are missing.');
  const url = new URL(endpoint + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  return withRequestSlot(async () => {
    for (let attempt = 0; ; attempt++) {
      const scheduledAt = Math.max(Date.now(), nextRequestAt);
      nextRequestAt = scheduledAt + 125;
      if (scheduledAt > Date.now()) await new Promise(resolve => setTimeout(resolve, scheduledAt - Date.now()));
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: key, 'x-oid': oid, Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        const retryHeader = response.headers.get('retry-after');
        const retrySeconds = Number(retryHeader);
        const retryMs = Number.isFinite(retrySeconds)
          ? retrySeconds * 1000
          : Math.max(0, Date.parse(retryHeader ?? '') - Date.now()) || 0;
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(500 * 2 ** attempt, retryMs))));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Infloww returned HTTP ${response.status}.`);
      }
      const body: ResponseBody<T> = await response.json();
      if (!Array.isArray(body.data?.list)) throw new Error('Unexpected Infloww response.');
      return body;
    }
  });
}

export async function list<T>(path: string, params: Query = {}, paginate = false) {
  const records: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const body: ResponseBody<T> = await request(path, {
      ...params, ...(paginate ? { limit: 100 } : {}), ...(cursor ? { cursor } : {}),
    });
    records.push(...body.data!.list!);
    if (!body.hasMore) return records;
    cursor = body.cursor;
    if (!cursor || cursors.has(cursor)) throw new Error('Infloww returned an invalid pagination cursor.');
    cursors.add(cursor);
  } while (cursor);
  return records;
}
