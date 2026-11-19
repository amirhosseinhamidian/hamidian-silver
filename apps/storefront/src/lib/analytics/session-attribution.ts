'use client';

import type { components } from '@hamidian/contracts';
import { ANALYTICS_ATTRIBUTION_KEY, analyticsConsentSince } from './analytics-consent';
import { CAMPAIGN_PARAMETERS } from './campaign-parameters';

type Touch = components['schemas']['AttributionTouchDto'];
type SessionAttribution = components['schemas']['SessionAttributionDto'];
const maxAge = 90 * 24 * 60 * 60 * 1000;
const repeatWindow = 30 * 60 * 1000;
const maximumTouches = 32;

function token(value: unknown, maxLength = 96) {
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/ +/g, '-');
  return /^[a-z0-9][a-z0-9._-]*$/.test(normalized) && normalized.length <= maxLength
    ? normalized
    : undefined;
}

function normalizeTouch(value: unknown): Touch | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { source, medium, campaign, content, campaignId, occurredAt } = value as Record<
    string,
    unknown
  >;
  const cleanSource = token(source);
  const cleanMedium = token(medium);
  if (
    !cleanSource ||
    !cleanMedium ||
    cleanSource === 'direct' ||
    cleanMedium === 'direct' ||
    cleanMedium === 'none' ||
    typeof occurredAt !== 'string'
  )
    return undefined;
  const cleanCampaign = token(campaign);
  const cleanContent = token(content);
  const cleanCampaignId = cleanCampaign && token(campaignId, 64);
  return {
    source: cleanSource,
    medium: cleanMedium,
    occurredAt,
    ...(cleanCampaign && { campaign: cleanCampaign }),
    ...(cleanContent && { content: cleanContent }),
    ...(cleanCampaignId && { campaignId: cleanCampaignId }),
  };
}

function referrerSource(referrer: string, currentHost: string) {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    const hostname = url.hostname.replace(/^www\./, '');
    const site = currentHost.replace(/^www\./, '');
    if (hostname === site || hostname.endsWith(`.${site}`) || site.endsWith(`.${hostname}`))
      return undefined;
    return token(hostname);
  } catch {
    return undefined;
  }
}

function visitTouch(
  params: URLSearchParams,
  referrer: string,
  host: string,
  now: number,
): Touch | undefined {
  const occurredAt = new Date(now).toISOString();
  const tags = new Map<string, string>();
  for (const [key, value] of params) {
    const normalized = key.toLowerCase();
    if (!CAMPAIGN_PARAMETERS.has(normalized)) continue;
    if (tags.has(normalized)) return undefined;
    tags.set(normalized, value);
  }
  if (tags.size) {
    return normalizeTouch({
      source: tags.get('utm_source'),
      medium: tags.get('utm_medium'),
      campaign: tags.get('utm_campaign'),
      content: tags.get('utm_content'),
      campaignId: tags.get('utm_id'),
      occurredAt,
    });
  }
  const source = referrerSource(referrer, host);
  return source ? { source, medium: 'referral', occurredAt } : undefined;
}

function readTouches(cached: string | null, earliest: number, now: number): Touch[] {
  let raw: unknown;
  try {
    raw = cached ? JSON.parse(cached) : null;
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.slice(-maximumTouches).flatMap((item) => {
    const touch = normalizeTouch(item);
    const timestamp = touch ? Date.parse(touch.occurredAt) : NaN;
    return touch && timestamp >= earliest && timestamp <= now ? [touch] : [];
  });
}

export function rememberAttributionVisit(params: URLSearchParams, referrer: string, host: string) {
  const consent = analyticsConsentSince();
  if (consent === null) return;
  const now = Date.now();
  const touch = visitTouch(params, referrer, host, now);
  try {
    const cached = window.localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY);
    const touches = readTouches(cached, Math.max(consent, now - maxAge), now);
    const last = touches.at(-1);
    const repeat =
      touch &&
      last &&
      now - Date.parse(last.occurredAt) < repeatWindow &&
      last.source === touch.source &&
      last.medium === touch.medium &&
      last.campaign === touch.campaign &&
      last.content === touch.content &&
      last.campaignId === touch.campaignId;
    if (touch && !repeat) touches.push(touch);
    const next = touches.length ? JSON.stringify(touches.slice(-maximumTouches)) : null;
    if (cached === next) return;
    if (next) window.localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY, next);
    else window.localStorage.removeItem(ANALYTICS_ATTRIBUTION_KEY);
  } catch {
    // Restricted browser storage can make attribution unavailable.
  }
}

export function attributionForOrder(): SessionAttribution | undefined {
  const consent = analyticsConsentSince();
  if (consent === null) return undefined;
  const now = Date.now();
  try {
    const touches = readTouches(
      window.localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY),
      Math.max(consent, now - maxAge),
      now,
    );
    return touches.length ? { version: 1, touches } : undefined;
  } catch {
    return undefined;
  }
}
