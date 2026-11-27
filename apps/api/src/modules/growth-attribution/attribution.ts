import type { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { AttributionModel } from '../../generated/prisma/enums';
import type { AttributionTouchDto } from './dto/attribution.dto';

const day = 24 * 60 * 60 * 1000;
const maximumTouches = 32;
const policyVersion = 1;
const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;
const DEFAULT_ATTRIBUTION_MODEL = AttributionModel.LAST_NON_DIRECT;

export function normalizeAttributionToken(value: unknown, maxLength = 96): string | undefined {
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  const token = value.normalize('NFKC').trim().toLowerCase().replace(/ +/g, '-');
  return /^[a-z0-9][a-z0-9._-]*$/.test(token) && token.length <= maxLength ? token : undefined;
}

export function isDirectAttribution(source: string, medium: string) {
  return source === 'direct' || medium === 'direct' || medium === 'none';
}

function record(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;
}

function parseTouch(
  value: unknown,
  earliest: number,
  now: number,
): AttributionTouchDto | undefined {
  const touch = record(value);
  if (!touch || typeof touch.occurredAt !== 'string' || touch.occurredAt.length !== 24)
    return undefined;
  const timestamp = Date.parse(touch.occurredAt);
  if (
    !Number.isFinite(timestamp) ||
    timestamp < earliest ||
    timestamp > now ||
    new Date(timestamp).toISOString() !== touch.occurredAt
  )
    return undefined;
  const source = normalizeAttributionToken(touch.source);
  const medium = normalizeAttributionToken(touch.medium);
  if (!source || !medium || isDirectAttribution(source, medium)) return undefined;
  const campaign = normalizeAttributionToken(touch.campaign);
  const content = normalizeAttributionToken(touch.content);
  const campaignId = campaign ? normalizeAttributionToken(touch.campaignId, 64) : undefined;
  return {
    source,
    medium,
    occurredAt: touch.occurredAt,
    ...(campaign && { campaign }),
    ...(content && { content }),
    ...(campaignId && { campaignId }),
  };
}

export function attributionPolicy(config?: Pick<ConfigService, 'get'>) {
  const configuredWindow = Number(config?.get('ATTRIBUTION_WINDOW_DAYS'));
  const windowDays =
    Number.isInteger(configuredWindow) && configuredWindow >= 1 && configuredWindow <= 90
      ? configuredWindow
      : DEFAULT_ATTRIBUTION_WINDOW_DAYS;
  const model: AttributionModel =
    config?.get('ATTRIBUTION_MODEL') === AttributionModel.FIRST_NON_DIRECT
      ? AttributionModel.FIRST_NON_DIRECT
      : DEFAULT_ATTRIBUTION_MODEL;
  return { model, windowDays };
}

export function eligibleAttributionTouches(input: unknown, windowDays: number, now: number) {
  const payload = record(input);
  if (
    payload?.version !== 1 ||
    !Array.isArray(payload.touches) ||
    payload.touches.length > maximumTouches
  )
    return [];
  const earliest = now - windowDays * day;
  return payload.touches
    .flatMap((candidate) => {
      const touch = parseTouch(candidate, earliest, now);
      return touch ? [touch] : [];
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export async function buildOrderAttribution(
  reader: Pick<Prisma.TransactionClient, 'campaignLinkIdentity'>,
  input: unknown,
  policy: ReturnType<typeof attributionPolicy>,
  now = Date.now(),
): Promise<Prisma.OrderAttributionCreateWithoutOrderInput | undefined> {
  const touches = eligibleAttributionTouches(input, policy.windowDays, now);
  const first = touches[0];
  const last = touches.at(-1);
  if (!first || !last) return undefined;
  const campaignIds = [
    ...new Set([first.campaignId, last.campaignId].flatMap((id) => (id ? [id] : []))),
  ];
  const known =
    campaignIds.length > 0
      ? await reader.campaignLinkIdentity.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, campaign: true },
        })
      : [];
  function verified(touch: AttributionTouchDto) {
    const { campaignId, ...fields } = touch;
    const match = known.find(
      (identity) => identity.id === campaignId && identity.campaign === touch.campaign,
    );
    return { ...fields, ...(match ? { campaignId: match.id } : {}) };
  }
  const firstTouch = verified(first);
  const lastTouch = verified(last);
  const selected = policy.model === AttributionModel.FIRST_NON_DIRECT ? firstTouch : lastTouch;
  return {
    ...policy,
    policyVersion,
    firstTouch,
    lastTouch,
    source: selected.source,
    medium: selected.medium,
    campaign: selected.campaign,
    content: selected.content,
    campaignId: selected.campaignId,
    attributedAt: new Date(selected.occurredAt),
  };
}
