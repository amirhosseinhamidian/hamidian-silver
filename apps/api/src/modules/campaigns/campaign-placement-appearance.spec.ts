import type { Prisma } from '../../generated/prisma/client';
import { validateCampaignPlacementAppearance } from './campaign-placement-appearance';

const tx = {} as Pick<Prisma.TransactionClient, 'media'>;

describe('campaign placement appearance', () => {
  it('preserves false for the optional countdown and normalizes a public CTA', async () => {
    await expect(
      validateCampaignPlacementAppearance(tx, 'COUNTDOWN', {
        display: {
          ctaLabel: ' دیدن مجموعه ',
          ctaPath: ' /products?sort=newest ',
          showCountdown: false,
        },
      }),
    ).resolves.toMatchObject({
      display: { ctaLabel: 'دیدن مجموعه', ctaPath: '/products?sort=newest', showCountdown: false },
    });
  });

  it('rejects unsupported placement settings and partial or external CTAs', async () => {
    await expect(
      validateCampaignPlacementAppearance(tx, 'NAVIGATION', {
        display: { showCountdown: false },
      }),
    ).rejects.toThrow('Display settings belong');
    await expect(
      validateCampaignPlacementAppearance(tx, 'COUNTDOWN', {
        display: { ctaPath: '/products' },
      }),
    ).rejects.toThrow('both the banner link and its label');
    await expect(
      validateCampaignPlacementAppearance(tx, 'COUNTDOWN', {
        display: { ctaLabel: 'دیدن مجموعه', ctaPath: '//example.test/products' },
      }),
    ).rejects.toThrow('public storefront path');
  });

  it('rejects a gradient that crosses the text brightness', async () => {
    await expect(
      validateCampaignPlacementAppearance(tx, 'NAVIGATION', {
        textColor: '#757575',
        display: { backgroundColor: '#000000', gradientColor: '#ffffff' },
      }),
    ).rejects.toThrow('contrasts with the campaign placement');
  });
});
