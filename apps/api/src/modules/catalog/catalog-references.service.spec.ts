import { ConflictException } from '@nestjs/common';
import { SeoRedirectEntityType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogReferencesService } from './catalog-references.service';
import type { PublicMediaUrlService } from './public-media-url.service';

describe('CatalogReferencesService', () => {
  const prisma = {
    brand: { findMany: jest.fn() },
    country: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const publicMediaUrl = {
    resolve: jest.fn((key: string) => `https://media.example/${key}`),
  };
  let service: CatalogReferencesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogReferencesService(
      prisma as unknown as PrismaService,
      publicMediaUrl as unknown as PublicMediaUrlService,
    );
  });

  it('normalizes country ISO codes and projects product counts', async () => {
    const transaction = {
      country: {
        create: jest.fn().mockResolvedValue({
          id: 'country-1',
          name: 'ایران',
          slug: 'iran',
          isoCode: 'IR',
          image: null,
          _count: { products: 3 },
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.createCountry({ name: ' ایران ', slug: ' iran ', isoCode: 'ir' }),
    ).resolves.toMatchObject({ id: 'country-1', isoCode: 'IR', productCount: 3 });
    expect(transaction.country.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'ایران', slug: 'iran', isoCode: 'IR' }),
      }),
    );
  });

  it('projects brand media with the public URL', async () => {
    prisma.brand.findMany.mockResolvedValue([
      {
        id: 'brand-1',
        name: 'حمیدیان',
        image: {
          id: 'media-1',
          storageKey: 'brands/logo.webp',
          mimeType: 'image/webp',
          altText: 'نشان حمیدیان',
          width: 200,
          height: 100,
        },
        heroImage: {
          id: 'media-2',
          storageKey: 'brands/hero.webp',
          mimeType: 'image/webp',
          altText: 'هیرو حمیدیان',
          width: 1920,
          height: 900,
        },
        _count: { products: 2 },
      },
    ]);

    await expect(service.listBrands()).resolves.toEqual([
      expect.objectContaining({
        id: 'brand-1',
        productCount: 2,
        image: expect.objectContaining({ url: 'https://media.example/brands/logo.webp' }),
        heroImage: expect.objectContaining({ url: 'https://media.example/brands/hero.webp' }),
      }),
    ]);
  });

  it('blocks archiving a reference assigned to products', async () => {
    const transaction = {
      brand: {
        findFirst: jest.fn().mockResolvedValue({ id: 'brand-1', _count: { products: 1 } }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.archiveBrand('brand-1')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.brand.update).not.toHaveBeenCalled();
  });

  it('records a permanent redirect when a brand slug changes', async () => {
    const transaction = {
      brand: {
        findFirst: jest.fn().mockResolvedValue({ id: 'brand-1', slug: 'old-brand' }),
        update: jest.fn().mockResolvedValue({
          id: 'brand-1',
          slug: 'new-brand',
          image: null,
          heroImage: null,
          seoOgMedia: null,
          _count: { products: 0 },
        }),
      },
      seoRedirect: {
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.updateBrand('brand-1', { slug: 'new-brand' });

    expect(transaction.seoRedirect.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourcePath: '/brands/old-brand',
          destinationPath: '/brands/new-brand',
          entityType: SeoRedirectEntityType.BRAND,
        }),
      }),
    );
  });

  it('maps duplicate country identifiers to a conflict response', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createCountry({ name: 'ایران', slug: 'iran', isoCode: 'IR' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
