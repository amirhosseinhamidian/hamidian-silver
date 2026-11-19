import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client';
import { AttributionModel } from '../../generated/prisma/enums';
import { PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import {
  attributionPolicy,
  buildOrderAttribution,
  eligibleAttributionTouches,
} from './attribution';
import { buildCampaignUrl } from './campaign-links.service';
import { GrowthAttributionController } from './growth-attribution.controller';
import { growthRevenuePeriod } from './growth-revenue.service';

const now = Date.parse('2026-11-20T10:00:00.000Z');
const touch = (source: string, date: string, medium = 'email') => ({
  source,
  medium,
  occurredAt: date,
});

const campaign = {
  destination: '/products?page=2#listing',
  source: 'Winter Newsletter',
  medium: 'EMAIL',
  campaign: 'Winter Sale',
  campaignId: 'winter-1',
  content: 'hero',
};

describe('growth revenue reporting', () => {
  it('requires finance permission for both reporting paths', () => {
    for (const handler of [
      GrowthAttributionController.prototype.summary,
      GrowthAttributionController.prototype.events,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PERMISSION_CODES.FINANCE_READ,
      ]);
    }
  });

  it('validates dates and bounds the reporting period', () => {
    const from = '2026-11-20';
    expect(growthRevenuePeriod({ from, to: from })).toEqual({
      from,
      to: from,
      timezone: 'Asia/Tehran',
    });
    for (const to of ['2026-11-19', '2026-11-31', '2027-02-20', '2026-11-20T00:00:00Z']) {
      expect(() => growthRevenuePeriod({ from, to })).toThrow();
    }
  });
});

describe('order attribution policy', () => {
  it('lets checkout proceed when an older client sends an unsupported attribution shape', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const body = {
      items: [{ variantId: '10000000-0000-4000-8000-000000000001', quantity: 1 }],
      attribution: 'old-format',
    };
    const dto = (await pipe.transform(body, {
      type: 'body',
      metatype: CreateOrderDto,
    })) as CreateOrderDto;
    expect(dto.items).toHaveLength(1);
    expect(eligibleAttributionTouches(dto.attribution, 30, now)).toEqual([]);
  });

  it('chooses the first or last non-direct touch within the configured window and verifies the campaign ID', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'winter-1', campaign: 'winter-sale' }]);
    const reader = { campaignLinkIdentity: { findMany } } as unknown as Pick<
      Prisma.TransactionClient,
      'campaignLinkIdentity'
    >;
    const input = {
      version: 1,
      touches: [
        {
          ...touch('NEWSLETTER', '2026-11-19T10:00:00.000Z'),
          campaign: 'Winter Sale',
          campaignId: 'quick-copy',
        },
        touch('old-campaign', '2026-11-11T10:00:00.000Z'),
        {
          ...touch('Telegram', '2026-11-17T10:00:00.000Z', 'social'),
          campaign: 'winter-sale',
          campaignId: 'winter-1',
          phone: 'ignored',
        },
        touch('future', '2026-11-21T10:00:00.000Z'),
        touch('direct', '2026-11-20T08:00:00.000Z', 'none'),
      ],
    };
    const first = attributionPolicy(
      new ConfigService({
        ATTRIBUTION_MODEL: AttributionModel.FIRST_NON_DIRECT,
        ATTRIBUTION_WINDOW_DAYS: 7,
      }),
    );
    const snapshot = await buildOrderAttribution(reader, input, first, now);
    expect(snapshot).toMatchObject({
      source: 'telegram',
      medium: 'social',
      campaignId: 'winter-1',
      policyVersion: 1,
      windowDays: 7,
      firstTouch: { source: 'telegram', campaignId: 'winter-1' },
      lastTouch: { source: 'newsletter' },
    });
    expect(snapshot?.firstTouch).not.toHaveProperty('phone');
    expect(snapshot?.lastTouch).not.toHaveProperty('campaignId');
    await expect(
      buildOrderAttribution(
        reader,
        input,
        { ...first, model: AttributionModel.LAST_NON_DIRECT },
        now,
      ),
    ).resolves.toMatchObject({ source: 'newsletter', campaign: 'winter-sale' });
  });

  it('ignores unsupported schemas, oversized payloads and direct visits', () => {
    const input = touch('direct', '2026-11-20T10:00:00.000Z', 'none');
    for (const value of [
      null,
      { version: 2, touches: [input] },
      { version: 1, touches: [input] },
      { version: 1, touches: Array(33).fill(input) },
    ]) {
      expect(eligibleAttributionTouches(value, 30, now)).toEqual([]);
    }
  });
});

describe('campaign links', () => {
  const origin = 'https://hamidian.shop';
  it('requires permission to write site settings', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        GrowthAttributionController.prototype.createCampaignLink,
      ),
    ).toEqual([PERMISSION_CODES.SETTINGS_WRITE]);
  });
  it('builds a normalized link and preserves supported filters and anchors', () => {
    const result = buildCampaignUrl(origin, campaign);
    expect(result.campaign).toBe('winter-sale');
    const url = new URL(result.url);
    expect(url.origin).toBe(origin);
    expect(url.hash).toBe('#listing');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      utm_source: 'winter-newsletter',
      utm_medium: 'email',
      utm_campaign: 'winter-sale',
      utm_id: 'winter-1',
      utm_content: 'hero',
    });
  });
  it.each([
    '//other.example/products',
    '/checkout',
    '/products?UTM_SOURCE=old',
    '/products?page=2&page=3',
    '/products/%2fcheckout',
  ])('rejects invalid or conflicting destination %s', (destination) =>
    expect(() => buildCampaignUrl(origin, { ...campaign, destination })).toThrow(),
  );
});
