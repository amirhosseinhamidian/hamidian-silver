import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogMediaService } from './catalog-media.service';
import type { CatalogUploadFile, LocalMediaStorageService } from './local-media-storage.service';
import type { PublicMediaUrlService } from './public-media-url.service';

describe('CatalogMediaService', () => {
  const prisma = {
    media: {
      create: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    brand: {
      findFirst: jest.fn(),
    },
    country: {
      findFirst: jest.fn(),
    },
    productMedia: {
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const localMediaStorage = {
    storeImage: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const publicMediaUrl = {
    resolve: jest.fn((storageKey: string) => `https://media.example/${storageKey}`),
  };
  const file: CatalogUploadFile = {
    buffer: Buffer.from('image-bytes'),
    mimetype: 'image/png',
    originalname: ' ring.png ',
    size: 11,
  };

  let service: CatalogMediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogMediaService(
      prisma as unknown as PrismaService,
      localMediaStorage as unknown as LocalMediaStorageService,
      publicMediaUrl as unknown as PublicMediaUrlService,
    );
  });

  it('requires an uploaded file', async () => {
    await expect(service.upload(undefined, {})).rejects.toBeInstanceOf(BadRequestException);

    expect(localMediaStorage.storeImage).not.toHaveBeenCalled();
  });

  it('persists trusted storage metadata after writing the image to disk', async () => {
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/image.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    prisma.media.create.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
    });

    await service.upload(file, { altText: '  انگشتر نقره  ' });

    expect(prisma.media.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'catalog/2026/09/image.png',
        originalName: 'ring.png',
        mimeType: 'image/png',
        sizeBytes: 11,
        altText: 'انگشتر نقره',
      },
    });
    expect(localMediaStorage.delete).not.toHaveBeenCalled();
  });

  it('removes the stored file if database persistence fails', async () => {
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/orphan.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    prisma.media.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.upload(file, {})).rejects.toThrow('database unavailable');

    expect(localMediaStorage.delete).toHaveBeenCalledWith('catalog/2026/09/orphan.png');
  });

  it('stores and attaches an uploaded product image with a public VPS URL', async () => {
    const productId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.productMedia.count.mockResolvedValue(0);
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/product.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    const transaction = {
      productMedia: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          mediaId,
          altText: 'نمای روبه‌رو',
          isPrimary: true,
          sortOrder: 0,
          media: {
            storageKey: 'catalog/2026/09/product.png',
            altText: 'نمای روبه‌رو',
            mimeType: 'image/png',
            originalName: 'ring.png',
            sizeBytes: 11,
            width: null,
            height: null,
          },
        }),
      },
      media: { create: jest.fn().mockResolvedValue({ id: mediaId }) },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.uploadForProduct(productId, file, { altText: 'نمای روبه‌رو' }),
    ).resolves.toMatchObject({
      id: mediaId,
      url: 'https://media.example/catalog/2026/09/product.png',
      isPrimary: true,
    });
    expect(transaction.productMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId, mediaId, isPrimary: true, sortOrder: 0 }),
      }),
    );
  });

  it('rejects an upload when the product gallery is full before writing a file', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'product-1' });
    prisma.productMedia.count.mockResolvedValue(12);

    await expect(service.uploadForProduct('product-1', file, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(localMediaStorage.storeImage).not.toHaveBeenCalled();
  });

  it('stores and replaces a category image on the configured media disk', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    prisma.category.findFirst.mockResolvedValue({ id: categoryId });
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/category.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    const transaction = {
      category: {
        findFirst: jest.fn().mockResolvedValue({ id: categoryId, imageId: null }),
        update: jest.fn(),
      },
      media: {
        create: jest.fn().mockResolvedValue({
          id: mediaId,
          storageKey: 'catalog/2026/09/category.png',
          mimeType: 'image/png',
          altText: 'انگشتر',
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.uploadForCategory(categoryId, file, { altText: 'انگشتر' }),
    ).resolves.toEqual({
      categoryId,
      image: {
        id: mediaId,
        url: 'https://media.example/catalog/2026/09/category.png',
        mimeType: 'image/png',
        altText: 'انگشتر',
      },
    });
    expect(transaction.category.update).toHaveBeenCalledWith({
      where: { id: categoryId },
      data: { imageId: mediaId },
    });
  });

  it('detaches and deletes an orphaned category image from disk', async () => {
    const categoryId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    const transaction = {
      category: {
        findFirst: jest.fn().mockResolvedValue({ id: categoryId, imageId: mediaId }),
        update: jest.fn(),
      },
      media: {
        findUnique: jest.fn().mockResolvedValue({
          storageKey: 'catalog/2026/09/category.webp',
          _count: {
            productMedia: 0,
            categoryImages: 0,
            brandImages: 0,
            countryImages: 0,
            siteSettingsCatalogHero: 0,
          },
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.removeCategoryImage(categoryId)).resolves.toEqual({ removed: true });
    expect(transaction.category.update).toHaveBeenCalledWith({
      where: { id: categoryId },
      data: { imageId: null },
    });
    expect(transaction.media.update).toHaveBeenCalledWith({
      where: { id: mediaId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(localMediaStorage.delete).toHaveBeenCalledWith('catalog/2026/09/category.webp');
  });

  it('stores and attaches a brand image through the shared media disk', async () => {
    const brandId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    prisma.brand.findFirst.mockResolvedValue({ id: brandId });
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/brand.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    const transaction = {
      brand: {
        findFirst: jest.fn().mockResolvedValue({ id: brandId, imageId: null }),
        update: jest.fn(),
      },
      media: {
        create: jest.fn().mockResolvedValue({
          id: mediaId,
          storageKey: 'catalog/2026/09/brand.png',
          mimeType: 'image/png',
          altText: 'حمیدیان',
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.uploadForBrand(brandId, file, { altText: 'حمیدیان' })).resolves.toEqual({
      brandId,
      image: {
        id: mediaId,
        url: 'https://media.example/catalog/2026/09/brand.png',
        mimeType: 'image/png',
        altText: 'حمیدیان',
      },
    });
    expect(transaction.brand.update).toHaveBeenCalledWith({
      where: { id: brandId },
      data: { imageId: mediaId },
    });
  });

  it('sets one product image as primary and clears the previous primary atomically', async () => {
    const productId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    const transaction = {
      productMedia: {
        findUnique: jest.fn().mockResolvedValue({ mediaId }),
        updateMany: jest.fn(),
        update: jest.fn().mockResolvedValue({
          mediaId,
          altText: 'نمای جدید',
          isPrimary: true,
          sortOrder: 1,
          media: {
            storageKey: 'catalog/2026/09/product.webp',
            altText: null,
            mimeType: 'image/webp',
            originalName: 'product.webp',
            sizeBytes: 2048,
            width: null,
            height: null,
          },
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateProductMedia(productId, mediaId, {
        isPrimary: true,
        altText: ' نمای جدید ',
      }),
    ).resolves.toMatchObject({ id: mediaId, isPrimary: true, altText: 'نمای جدید' });
    expect(transaction.productMedia.updateMany).toHaveBeenCalledWith({
      where: { productId, mediaId: { not: mediaId } },
      data: { isPrimary: false },
    });
  });

  it('promotes the next image and removes an orphaned file from disk', async () => {
    const productId = '10000000-0000-4000-8000-000000000001';
    const mediaId = '10000000-0000-4000-8000-000000000002';
    const nextMediaId = '10000000-0000-4000-8000-000000000003';
    const transaction = {
      productMedia: {
        findUnique: jest.fn().mockResolvedValue({
          isPrimary: true,
          media: { storageKey: 'catalog/2026/09/product.webp' },
        }),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ mediaId: nextMediaId }),
        update: jest.fn(),
      },
      media: {
        findUnique: jest.fn().mockResolvedValue({
          storageKey: 'catalog/2026/09/product.webp',
          _count: {
            productMedia: 0,
            categoryImages: 0,
            brandImages: 0,
            countryImages: 0,
            siteSettingsCatalogHero: 0,
          },
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.removeProductMedia(productId, mediaId)).resolves.toEqual({
      removed: true,
    });
    expect(transaction.productMedia.update).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId, mediaId: nextMediaId } },
      data: { isPrimary: true },
    });
    expect(transaction.media.update).toHaveBeenCalledWith({
      where: { id: mediaId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(localMediaStorage.delete).toHaveBeenCalledWith('catalog/2026/09/product.webp');
  });
});
