import { Advertisement } from '../models/Advertisement.js';
import { HotDeal } from '../models/HotDeal.js';
import { Promotion } from '../models/Promotion.js';
import { logger } from '../utils/logger.js';

/**
 * Persist time-based status transitions (scheduled → active, → expired).
 * Public queries also filter by date windows, so visitors never see an expired
 * campaign even between scheduler runs; this keeps stored statuses accurate
 * for the admin screens and reports.
 */
export async function syncCampaignStatuses() {
  const [ads, promotions, deals] = await Promise.all([
    Advertisement.syncStatuses(),
    Promotion.syncStatuses(),
    HotDeal.syncStatuses(),
  ]);
  return { advertisements: ads, promotions, hotDeals: deals };
}

export function startCampaignScheduler(intervalMs = 60_000) {
  const run = async () => {
    try {
      const result = await syncCampaignStatuses();
      const changed = Object.values(result).reduce((n, r) => n + r.activated + r.expired, 0);
      if (changed) logger.info('Campaign statuses synchronised', result);
    } catch (error) {
      logger.error('Campaign scheduler failed', error.message);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
