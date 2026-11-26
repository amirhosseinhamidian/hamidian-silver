import { jest } from '@jest/globals';
import type { Campaign, CampaignLanding, Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CatalogService } from '../catalog/catalog.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { emptyCampaignProducts } from './campaign-collection';
import { FestivalDesignService } from './festival-design.service';
import { festivalThemePresets } from './festival-theme';
import type { FestivalDesignDto } from './dto/festival-design.dto';

describe('FestivalDesignService project', () => {
  it('finds product overrides above the section threshold and stops once the section is filled', async () => {
    const campaign = {
      id: 'festival',
      audience: 'ALL_CUSTOMERS',
      allProducts: true,
      startsAt: new Date('2026-11-26T00:00:00Z'),
      endsAt: new Date('2026-11-28T00:00:00Z'),
    } as Campaign;
    const landing = { filters: {}, collectionMode: 'FILTERED' } as CampaignLanding;
    const eligible = {
      id: 'eligible',
      campaignOffer: { campaignId: campaign.id, price: { discountPercent: 30 } },
    };
    const read = jest.fn((_tx: unknown, _query: unknown, _selection: unknown, page: number) => ({
      page,
      totalPages: 3,
      items:
        page === 1
          ? [
              {
                id: 'other-campaign',
                campaignOffer: { campaignId: 'different', price: { discountPercent: 50 } },
              },
            ]
          : [eligible],
    }));
    const catalog = {
      campaignCollectionPromotions: jest.fn(() => [
        {
          campaignId: campaign.id,
          kind: 'PERCENT',
          value: 1_000,
          percentageOverrides: [{ productId: eligible.id, rateBps: 3_000 }],
          maxDiscountBps: 3_000,
          couponCode: null,
          minSubtotalToman: 0,
          campaign: { audience: 'ALL_CUSTOMERS' },
        },
      ]),
      readCampaignCollection: read,
    } as unknown as CatalogService;
    const service = new FestivalDesignService(
      {} as PrismaService,
      catalog,
      {} as PublicMediaUrlService,
    );
    const design: FestivalDesignDto = {
      schemaVersion: 1,
      theme: festivalThemePresets[0].theme,
      sections: [
        {
          kind: 'DISCOUNTS',
          title: 'تخفیف‌ها',
          enabled: true,
          layout: 'GRID',
          threshold: 25,
          itemLimit: 1,
        },
        { kind: 'PRODUCTS', title: 'همهٔ محصولات', enabled: true, layout: 'GRID' },
      ],
    };

    const published = await service.project(
      {} as Prisma.TransactionClient,
      campaign,
      landing,
      design,
      emptyCampaignProducts(),
      new Date('2026-11-27T00:00:00Z'),
    );

    expect(published.sections[0].products).toEqual([eligible]);
    expect(read.mock.calls.map(([, , , page]) => page)).toEqual([1, 2]);
  });
});
