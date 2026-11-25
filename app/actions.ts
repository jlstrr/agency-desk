'use server';

import { getDashboard, invalidateDashboard } from '@/lib/dashboard';
import type { Days } from '@/lib/types';

export async function refreshDashboard(days: Days) {
  if (days !== 7 && days !== 30 && days !== 90) throw new Error('Invalid reporting period');
  invalidateDashboard(days);
  return getDashboard(days);
}
