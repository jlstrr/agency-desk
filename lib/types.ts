export type Days = 7 | 30 | 90;

export interface DashboardData {
  days: Days;
  start: string;
  end: string;
  fetchedAt: string;
  issues: { section: string; message: string }[];
  revenue: number | null;
  previousRevenue: number | null;
  subscribers: number | null;
  activeFans: number | null;
  chatterSales: number | null;
  series: { date: string; revenue: number }[];
  revenueMix: { label: string; revenue: number }[];
  creators: { id: string; name: string; handle: string; revenue: number | null; subscribers: number | null; activeFans: number | null }[];
  chatters: { id: string; name: string; sales: number | null; messages: number | null; fans: number | null; unlockRate: number | null }[];
  promotions: { id: string; name: string; creator: string; type: string; clicks: number | null; subscribers: number | null; revenue: number | null }[];
}
