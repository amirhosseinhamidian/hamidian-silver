import { BadRequestException, ConflictException } from '@nestjs/common';
import { SeoRedirectEntityType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogCategoriesService } from './catalog-categories.service';
import type { PublicMediaUrlService } from './public-media-url.service';

describe('CatalogCategoriesService', () => {
  const prisma = {
    category: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const publicMediaUrl = {
    resolve: jest.fn((key: string) => `https://media.example/${key}`),
  };
  let service: CatalogCategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogCategoriesService(
      prisma as unknown as PrismaService,
      publicMediaUrl as unknown as PublicMediaUrlService,
    );
  });

  it('creates and projects a root category', async () => {
    const transaction = {
      category: {
        create: jest.fn().mockResolvedValue({
          id: 'category-1',
          name: 'انگشتر',
          slug: 'rings',
          image: null,
          parent: null,
          _count: { children: 0, products: 0 },
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.create({ name: ' انگشتر ', slug: ' rings ' })).resolves.toMatchObject({
      id: 'category-1',
      childCount: 0,
      productCount: 0,
    });
    expect(transaction.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'انگشتر', slug: 'rings', sortOrder: 0 }),
      }),
    );
  });

  it('rejects a parent change that creates a hierarchy cycle', async () => {
    const transaction = {
      category: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'category-1', isActive: true, parentId: null })
          .mockResolvedValueOnce({ id: 'category-2' })
          .mockResolvedValueOnce({ parentId: 'category-1' }),
        count: jest.fn(),
        update: jest.fn(),
      },
      media: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.update('category-1', { parentId: 'category-2' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.category.update).not.toHaveBeenCalled();
  });

  it('keeps a parent active while it has active children', async () => {
    const transaction = {
      category: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'category-1',
          isActive: true,
          parentId: null,
        }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
      media: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.update('category-1', { isActive: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.category.update).not.toHaveBeenCalled();
  });

  it('records a permanent redirect when a category slug changes', async () => {
    const transaction = {
      category: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'category-1',
          slug: 'old-rings',
          isActive: true,
          parentId: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'category-1',
          slug: 'new-rings',
          parent: null,
          image: null,
          seoOgMedia: null,
          _count: { children: 0, products: 0 },
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

    await service.update('category-1', { slug: 'new-rings' });

    expect(transaction.seoRedirect.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourcePath: '/categories/old-rings',
          destinationPath: '/categories/new-rings',
          entityType: SeoRedirectEntityType.CATEGORY,
        }),
      }),
    );
  });

  it('blocks archiving categories still assigned to products', async () => {
    const transaction = {
      category: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'category-1',
          _count: { children: 0, products: 2 },
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.archive('category-1')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.category.update).not.toHaveBeenCalled();
  });

  it('maps duplicate slugs to a conflict response', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ name: 'انگشتر', slug: 'rings' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
