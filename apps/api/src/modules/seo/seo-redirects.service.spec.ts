import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { SeoRedirectEntityType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { recordSeoSlugChange, SeoRedirectsService } from './seo-redirects.service';

describe('SEO redirects', () => {
  it('records a slug change and collapses existing redirect chains', async () => {
    const transaction = {
      seoRedirect: {
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    await recordSeoSlugChange(
      transaction as unknown as Prisma.TransactionClient,
      SeoRedirectEntityType.PRODUCT,
      '10000000-0000-4000-8000-000000000001',
      'old-ring',
      'new-ring',
    );

    expect(transaction.seoRedirect.deleteMany).toHaveBeenCalledWith({
      where: { sourcePath: '/products/new-ring' },
    });
    expect(transaction.seoRedirect.updateMany).toHaveBeenCalledWith({
      where: { destinationPath: '/products/old-ring' },
      data: { destinationPath: '/products/new-ring' },
    });
    expect(transaction.seoRedirect.upsert).toHaveBeenCalledWith({
      where: { sourcePath: '/products/old-ring' },
      create: {
        sourcePath: '/products/old-ring',
        destinationPath: '/products/new-ring',
        entityType: SeoRedirectEntityType.PRODUCT,
        entityId: '10000000-0000-4000-8000-000000000001',
      },
      update: {
        destinationPath: '/products/new-ring',
        entityType: SeoRedirectEntityType.PRODUCT,
        entityId: '10000000-0000-4000-8000-000000000001',
      },
    });
  });

  it('resolves a historical path only while its destination remains public', async () => {
    const prisma = {
      seoRedirect: {
        findUnique: jest.fn().mockResolvedValue({
          destinationPath: '/products/new-ring',
          entityType: SeoRedirectEntityType.PRODUCT,
          entityId: '10000000-0000-4000-8000-000000000001',
        }),
      },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'product-1' }) },
      category: { findFirst: jest.fn() },
      brand: { findFirst: jest.fn() },
    };
    const service = new SeoRedirectsService(prisma as unknown as PrismaService);

    await expect(service.resolve('/products/old-ring')).resolves.toEqual({
      destinationPath: '/products/new-ring',
      permanent: true,
    });

    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.resolve('/products/old-ring')).rejects.toBeInstanceOf(NotFoundException);
  });
});
