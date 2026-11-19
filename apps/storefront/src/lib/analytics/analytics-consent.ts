'use client';

const CONSENT_KEY = 'hamidian-analytics-consent-v1';
const CONSENT_CHANGE = 'hamidian-analytics-consent-change';
export const FUNNEL_SESSION_KEY = 'hamidian-funnel-session-v1';
export const FUNNEL_ORDER_EVENTS_KEY = 'hamidian-funnel-orders-v1';
export const ANALYTICS_ATTRIBUTION_KEY = 'hamidian-attribution-v1';
let deniedInTab = false;

export function analyticsConsentSince(): number | null {
  if (deniedInTab) return null;
  try {
    const timestamp = Number(window.localStorage.getItem(CONSENT_KEY));
    return Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp <= Date.now()
      ? timestamp
      : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(allowed: boolean): boolean {
  try {
    if (allowed) {
      if (analyticsConsentSince() === null) {
        window.localStorage.setItem(CONSENT_KEY, String(Date.now()));
      }
      deniedInTab = false;
    } else {
      deniedInTab = true;
      window.localStorage.removeItem(CONSENT_KEY);
      deniedInTab = false;
      window.localStorage.removeItem(FUNNEL_ORDER_EVENTS_KEY);
      window.localStorage.removeItem(ANALYTICS_ATTRIBUTION_KEY);
      window.sessionStorage.removeItem(FUNNEL_SESSION_KEY);
    }
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(CONSENT_CHANGE));
  }
  return true;
}

export function subscribeToAnalyticsConsent(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CONSENT_KEY) return;
    if (analyticsConsentSince() === null) {
      try {
        window.sessionStorage.removeItem(FUNNEL_SESSION_KEY);
      } catch {
        // Storage may be unavailable in private or restricted sessions.
      }
    }
    onChange();
  };

  window.addEventListener(CONSENT_CHANGE, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
