import { BadRequestException } from '@nestjs/common';

import { StorefrontContentPageKey } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { ContentPagesService } from './content-pages.service';

const actorUserId = '10000000-0000-4000-8000-000000000001';
const mediaId = '20000000-0000-4000-8000-000000000001';

describe('ContentPagesService', () => {
  const prisma = {
    storefrontContentPage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    media: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const publicMediaUrlService = {
    resolve: jest.fn((key: string) => `https://media.hamidian.test/${key}`),
  };
  let service: ContentPagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentPagesService(
      prisma as unknown as PrismaService,
      publicMediaUrlService as unknown as PublicMediaUrlService,
    );
  });

  it('returns designed Persian defaults before the page is configured', async () => {
    prisma.storefrontContentPage.findUnique.mockResolvedValue(null);

    const page = await service.getPublicPage(StorefrontContentPageKey.ABOUT);

    expect(page).toEqual(
      expect.objectContaining({
        key: StorefrontContentPageKey.ABOUT,
        title: 'روایت نقره حمیدیان',
        heroMedia: null,
      }),
    );
    expect(page.sections).toHaveLength(3);
  });

  it('provides a configurable size-guide default with practical guidance', async () => {
    prisma.storefrontContentPage.findUnique.mockResolvedValue(null);

    const page = await service.getPublicPage(StorefrontContentPageKey.SIZE_GUIDE);

    expect(page).toEqual(
      expect.objectContaining({
        key: StorefrontContentPageKey.SIZE_GUIDE,
        title: 'راهنمای انتخاب سایز',
        heroMedia: null,
      }),
    );
    expect(page.sections).toHaveLength(3);
  });

  it('provides purchase-support FAQs without offering unrestricted returns', async () => {
    prisma.storefrontContentPage.findUnique.mockResolvedValue(null);

    const page = await service.getPublicPage(StorefrontContentPageKey.FAQ);

    expect(page).toEqual(
      expect.objectContaining({
        key: StorefrontContentPageKey.FAQ,
        title: 'سوالات متداول',
        heroMedia: null,
      }),
    );
    expect(page.sections).toHaveLength(10);
    expect(page.sections.find((section) => section.title.includes('مرجوع'))?.body).toContain(
      'پس از تأیید ادمین',
    );
  });

  it('requires an active image for about, contact, and services updates', async () => {
    prisma.storefrontContentPage.findUnique.mockResolvedValue(null);

    await expect(
      service.updatePage(
        StorefrontContentPageKey.CONTACT,
        { title: 'تماس با ما', sections: [] },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.media.findFirst.mockResolvedValue({ mimeType: 'application/pdf' });
    await expect(
      service.updatePage(
        StorefrontContentPageKey.SERVICES,
        { title: 'خدمات ما', heroMediaId: mediaId, sections: [] },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces ordered sections transactionally and projects the configured hero', async () => {
    prisma.storefrontContentPage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: StorefrontContentPageKey.ABOUT,
        title: 'داستان ما',
        eyebrow: 'درباره ما',
        subtitle: null,
        body: 'متن صفحه',
        heroMediaId: mediaId,
        seoTitle: null,
        seoDescription: null,
        updatedByUserId: actorUserId,
        updatedAt: new Date('2026-09-07T12:00:00.000Z'),
        heroMedia: {
          storageKey: 'content/about.webp',
          altText: 'زیورآلات نقره',
          width: 1920,
          height: 1080,
          deletedAt: null,
        },
        sections: [{ title: 'اصالت', body: 'تعهد به کیفیت' }],
      });
    prisma.media.findFirst.mockResolvedValue({ mimeType: 'image/webp' });
    const transaction = {
      storefrontContentPage: { upsert: jest.fn() },
      storefrontContentSection: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<void>) => callback(transaction),
    );

    const result = await service.updatePage(
      StorefrontContentPageKey.ABOUT,
      {
        title: '  داستان ما  ',
        eyebrow: ' درباره ما ',
        body: 'متن صفحه',
        heroMediaId: mediaId,
        sections: [{ title: '  اصالت  ', body: 'تعهد به کیفیت' }],
      },
      actorUserId,
    );

    expect(transaction.storefrontContentSection.createMany).toHaveBeenCalledWith({
      data: [
        {
          pageKey: StorefrontContentPageKey.ABOUT,
          title: 'اصالت',
          body: 'تعهد به کیفیت',
          sortOrder: 1,
        },
      ],
    });
    expect(result.heroMedia).toEqual({
      url: 'https://media.hamidian.test/content/about.webp',
      altText: 'زیورآلات نقره',
      width: 1920,
      height: 1080,
    });
  });
});
