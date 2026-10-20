import { AppError } from '../utils/AppError.js';

const toDate = (v) => (v instanceof Date ? v : v ? new Date(v) : null);

/**
 * Decide the stored status when a campaign is published/activated.
 * - start in the future → "scheduled"
 * - window already open → "active"
 * - end date in the past → rejected (an expired campaign can never go live)
 */
export function resolveLaunchStatus({ startAt, endAt }, now = new Date()) {
  const start = toDate(startAt);
  const end = toDate(endAt);
  if (!start || Number.isNaN(start.getTime())) throw AppError.validation([{ path: 'startAt', message: 'Start date is required' }]);
  if (end && end <= start) throw AppError.validation([{ path: 'endAt', message: 'End date must be after the start date' }]);
  if (end && end <= now) {
    throw AppError.validation(
      [{ path: 'endAt', message: 'The end date has already passed. Extend the schedule before publishing.' }],
      'Cannot publish an expired campaign',
    );
  }
  return start > now ? 'scheduled' : 'active';
}

/**
 * Status as visitors would experience it right now, independent of whether the
 * background scheduler has already persisted the transition.
 */
export function effectiveStatus({ status, startAt, endAt }, now = new Date()) {
  const start = toDate(startAt);
  const end = toDate(endAt);
  if (['scheduled', 'active', 'paused'].includes(status) && end && end <= now) return 'expired';
  if (status === 'scheduled' && start && start <= now) return 'active';
  if (status === 'active' && start && start > now) return 'scheduled';
  return status;
}

/** True when a record with a stored status would be shown publicly right now. */
export function isLiveNow(record, now = new Date()) {
  return effectiveStatus(record, now) === 'active';
}

/** Allowed transitions for advertisements and promotions. */
export const CAMPAIGN_TRANSITIONS = {
  publish: ['draft', 'paused', 'expired', 'scheduled', 'active'],
  pause: ['scheduled', 'active'],
  archive: ['draft', 'scheduled', 'active', 'paused', 'expired'],
  restore: ['archived'],
};

export function assertTransition(action, currentStatus, transitions = CAMPAIGN_TRANSITIONS) {
  if (!transitions[action]?.includes(currentStatus)) {
    throw AppError.conflict(`Cannot ${action} a campaign that is ${currentStatus}.`);
  }
}
