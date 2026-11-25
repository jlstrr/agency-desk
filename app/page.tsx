import Dashboard from './dashboard';
import { getDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ days?: string | string[] }> }) {
  const { days } = await searchParams;
  const range = days === '7' ? 7 : days === '90' ? 90 : 30;
  return <Dashboard data={await getDashboard(range)} />;
}
