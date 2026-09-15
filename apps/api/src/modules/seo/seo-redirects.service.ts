import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ProductStatus, SeoRedirectEntityType } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';

function entityPath(entityType: SeoRedirectEntityType, slug: string): string {
  switch (entityType) {
    case SeoRedirectEntityType.PRODUCT:
      return `/products/${slug}`;
    case SeoRedirectEntityType.CATEGORY:
      return `/categories/${slug}`;
    case SeoRedirectEntityType.BRAND:
      return `/brands/${slug}`;
    default:
      throw new Error(`Unsupported SEO redirect entity type: ${String(entityType)}`);
  }
}

export async function recordSeoSlugChange(
  transaction: Prisma.TransactionClient,
  entityType: SeoRedirectEntityType,
  entityId: string,
  previousSlug: string,
  nextSlug: string,
): Promise<void> {
  if (previousSlug === nextSlug) return;

  const sourcePath = entityPath(entityType, previousSlug);
  const destinationPath = entityPath(entityType, nextSlug);

  // A path that becomes canonical again must never keep redirecting elsewhere.
  await transaction.seoRedirect.deleteMany({ where: { sourcePath: destinationPath } });

  // Collapse redirect chains so every historical path resolves in a single hop.
  await transaction.seoRedirect.updateMany({
    where: { destinationPath: sourcePath },
    data: { destinationPath },
  });

  await transaction.seoRedirect.upsert({
    where: { sourcePath },
    create: { sourcePath, destinationPath, entityType, entityId },
    update: { destinationPath, entityType, entityId },
  });
}

@Injectable()
export class SeoRedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(sourcePath: string) {
    const redirect = await this.prisma.seoRedirect.findUnique({
      where: { sourcePath },
      select: { destinationPath: true, entityType: true, entityId: true },
    });

    if (!redirect || !(await this.isPublicDestination(redirect.entityType, redirect.entityId))) {
      throw new NotFoundException('SEO redirect was not found.');
    }

    return { destinationPath: redirect.destinationPath, permanent: true };
  }

  private async isPublicDestination(
    entityType: SeoRedirectEntityType,
    entityId: string,
  ): Promise<boolean> {
    switch (entityType) {
      case SeoRedirectEntityType.PRODUCT:
        return Boolean(
          await this.prisma.product.findFirst({
            where: { id: entityId, status: ProductStatus.ACTIVE, deletedAt: null },
            select: { id: true },
          }),
        );
      case SeoRedirectEntityType.CATEGORY:
        return Boolean(
          await this.prisma.category.findFirst({
            where: { id: entityId, isActive: true, deletedAt: null },
            select: { id: true },
          }),
        );
      case SeoRedirectEntityType.BRAND:
        return Boolean(
          await this.prisma.brand.findFirst({
            where: { id: entityId, isActive: true, deletedAt: null },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }
}
