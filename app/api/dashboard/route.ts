import { getDashboard } from '@/lib/dashboard';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('days');
  const days = query === '7' ? 7 : query === '30' ? 30 : query === '90' ? 90 : null;
  if (days === null) return Response.json({ error: 'Invalid reporting period' }, { status: 400 });
  return Response.json(await getDashboard(days), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
