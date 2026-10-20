// Campaign analytics beacons + click-through attribution.
// The server de-duplicates per visitor per day; this module also avoids
// re-sending the same event during a single page session.

const sent = new Set();
const ATTRIBUTION_KEY = 'kpr_attribution';

function post(path, body) {
  const key = `${path}:${JSON.stringify(body)}`;
  if (sent.has(key)) return;
  sent.add(key);
  fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {});
}

export const trackAdImpression = (advertisementId) => post('/events/ad', { advertisementId, eventType: 'impression' });
export const trackAdClick = (advertisementId) => {
  rememberAttribution({ advertisementId });
  post('/events/ad', { advertisementId, eventType: 'click' });
};

export const trackCampaignView = (entityType, entityId) => post('/events/campaign', { entityType, entityId, eventType: 'view' });
export const trackCampaignClick = (entityType, entityId) => {
  if (entityType === 'promotion') rememberAttribution({ promotionId: entityId });
  if (entityType === 'hot_deal') rememberAttribution({ hotDealId: entityId });
  post('/events/campaign', { entityType, entityId, eventType: 'click' });
};

/** Remember which campaign the visitor clicked through (this browser tab session only). */
function rememberAttribution(values) {
  try {
    const current = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? '{}');
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...current, ...values }));
  } catch {
    // Storage unavailable (private mode) — attribution is simply skipped.
  }
}

export function getAttribution() {
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? '{}');
  } catch {
    return {};
  }
}
