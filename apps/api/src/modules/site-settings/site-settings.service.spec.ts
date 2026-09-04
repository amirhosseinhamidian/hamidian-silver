import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { SiteSettingsService } from './site-settings.service';

const actorUserId = '30000000-0000-4000-8000-000000000001';
const mediaId = '40000000-0000-4000-8000-000000000001';

function settingsRecord(overrides: Record<string, unknown> = {}) {
  return {
    catalogHeroEnabled: true,
    catalogHeroTitle: 'کالکشن جدید',
    catalogHeroSubtitle: 'انتخاب‌های تازه نقره',
    catalogHeroMediaId: mediaId,
    updatedByUserId: actorUserId,
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
    catalogHeroMedia: {
      storageKey: 'catalog/2026/09/hero.webp',
      altText: 'کالکشن نقره',
      deletedAt: null,
    },
    ...overrides,
  };
}

describe('SiteSettingsService', () => {
  const prisma = {
    siteSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    media: {
      findFirst: jest.fn(),
    },
  };
  const publicMediaUrlService = {
    resolve: jest.fn((storageKey: string) => `https://media.hamidian.test/${storageKey}`),
  };

  let service: SiteSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SiteSettingsService(
      prisma as unknown as PrismaService,
      publicMediaUrlService as unknown as PublicMediaUrlService,
    );
  });

  it('returns safe public defaults when settings have not been created yet', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);

    await expect(service.getPublicSettings()).resolves.toEqual({
      catalogHeroEnabled: false,
      catalogHeroTitle: null,
      catalogHeroSubtitle: null,
      catalogHeroMedia: null,
    });
  });

  it('projects only public media fields and resolves its public URL', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(settingsRecord());

    await expect(service.getPublicSettings()).resolves.toEqual({
      catalogHeroEnabled: true,
      catalogHeroTitle: 'کالکشن جدید',
      catalogHeroSubtitle: 'انتخاب‌های تازه نقره',
      catalogHeroMedia: {
        url: 'https://media.hamidian.test/catalog/2026/09/hero.webp',
        altText: 'کالکشن نقره',
      },
    });
  });

  it('does not expose a soft-deleted hero image publicly', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(
      settingsRecord({
        catalogHeroMedia: {
          storageKey: 'catalog/2026/09/hero.webp',
          altText: 'کالکشن نقره',
          deletedAt: new Date('2026-09-04T12:30:00.000Z'),
        },
      }),
    );

    const result = await service.getPublicSettings();

    expect(result.catalogHeroMedia).toBeNull();
    expect(publicMediaUrlService.resolve).not.toHaveBeenCalled();
  });

  it('requires an active image before enabling the catalog hero', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue({
      catalogHeroEnabled: false,
      catalogHeroTitle: null,
      catalogHeroSubtitle: null,
      catalogHeroMediaId: null,
    });

    await expect(
      service.updateSettings({ catalogHeroEnabled: true }, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.siteSettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects a missing or non-image hero media record', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.media.findFirst.mockResolvedValue(null);

    await expect(
      service.updateSettings(
        {
          catalogHeroEnabled: true,
          catalogHeroMediaId: mediaId,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.siteSettings.upsert).not.toHaveBeenCalled();
  });


  it('allows nullable hero copy to be cleared explicitly', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue({
      catalogHeroEnabled: false,
      catalogHeroTitle: 'عنوان قبلی',
      catalogHeroSubtitle: 'متن قبلی',
      catalogHeroMediaId: null,
    });
    prisma.siteSettings.upsert.mockResolvedValue(
      settingsRecord({
        catalogHeroEnabled: false,
        catalogHeroTitle: null,
        catalogHeroSubtitle: null,
        catalogHeroMediaId: null,
        catalogHeroMedia: null,
      }),
    );

    await service.updateSettings(
      {
        catalogHeroTitle: null,
        catalogHeroSubtitle: null,
      },
      actorUserId,
    );

    expect(prisma.siteSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          catalogHeroTitle: null,
          catalogHeroSubtitle: null,
        }),
      }),
    );
  });

  it('normalizes text and records the user who updated settings', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.media.findFirst.mockResolvedValue({ mimeType: 'image/webp' });
    prisma.siteSettings.upsert.mockResolvedValue(
      settingsRecord({
        catalogHeroTitle: 'کالکشن جدید',
        catalogHeroSubtitle: null,
      }),
    );

    await service.updateSettings(
      {
        catalogHeroEnabled: true,
        catalogHeroTitle: '  کالکشن جدید  ',
        catalogHeroSubtitle: '   ',
        catalogHeroMediaId: mediaId,
      },
      actorUserId,
    );

    expect(prisma.siteSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'site' },
      create: {
        id: 'site',
        catalogHeroEnabled: true,
        catalogHeroTitle: 'کالکشن جدید',
        catalogHeroSubtitle: null,
        catalogHeroMediaId: mediaId,
        updatedByUserId: actorUserId,
      },
      update: {
        catalogHeroEnabled: true,
        catalogHeroTitle: 'کالکشن جدید',
        catalogHeroSubtitle: null,
        catalogHeroMediaId: mediaId,
        updatedByUserId: actorUserId,
      },
      include: {
        catalogHeroMedia: true,
      },
    });
  });
});
