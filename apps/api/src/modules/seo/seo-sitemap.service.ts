import { Injectable } from '@nestjs/common';
import { ProductStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';

const sitemapMediaSelect = {
  storageKey: true,
  deletedAt: true,
} as const;

@Injectable()
export class SeoSitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async getPublicSitemap() {
    const [products, categories, brands, contentPages] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE, deletedAt: null },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          slug: true,
          seoCanonicalPath: true,
          seoNoIndex: true,
          updatedAt: true,
          brandId: true,
          categories: { select: { categoryId: true } },
          media: {
            where: { media: { deletedAt: null } },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { media: { select: sitemapMediaSelect } },
          },
        },
      }),
      this.prisma.category.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          slug: true,
          parentId: true,
          seoCanonicalPath: true,
          seoNoIndex: true,
          updatedAt: true,
          image: { select: sitemapMediaSelect },
          seoOgMedia: { select: sitemapMediaSelect },
        },
      }),
      this.prisma.brand.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          slug: true,
          seoCanonicalPath: true,
          seoNoIndex: true,
          updatedAt: true,
          image: { select: sitemapMediaSelect },
          heroImage: { select: sitemapMediaSelect },
          seoOgMedia: { select: sitemapMediaSelect },
        },
      }),
      this.prisma.storefrontContentPage.findMany({
        orderBy: { key: 'asc' },
        select: {
          key: true,
          seoCanonicalPath: true,
          seoNoIndex: true,
          updatedAt: true,
          heroMedia: { select: sitemapMediaSelect },
          seoOgMedia: { select: sitemapMediaSelect },
        },
      }),
    ]);

    const activeCategoryIds = new Set(categories.map(({ id }) => id));
    const activeBrandIds = new Set(brands.map(({ id }) => id));

    return {
      products: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        seoCanonicalPath: product.seoCanonicalPath,
        seoNoIndex: product.seoNoIndex,
        updatedAt: product.updatedAt.toISOString(),
        brandId: product.brandId && activeBrandIds.has(product.brandId) ? product.brandId : null,
        categoryIds: product.categories
          .map(({ categoryId }) => categoryId)
          .filter((categoryId) => activeCategoryIds.has(categoryId)),
        imageUrl: this.resolveMediaUrl(product.media[0]?.media),
      })),
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        parentId: category.parentId,
        seoCanonicalPath: category.seoCanonicalPath,
        seoNoIndex: category.seoNoIndex,
        updatedAt: category.updatedAt.toISOString(),
        imageUrl: this.resolveMediaUrl(category.seoOgMedia) ?? this.resolveMediaUrl(category.image),
      })),
      brands: brands.map((brand) => ({
        id: brand.id,
        slug: brand.slug,
        seoCanonicalPath: brand.seoCanonicalPath,
        seoNoIndex: brand.seoNoIndex,
        updatedAt: brand.updatedAt.toISOString(),
        imageUrl:
          this.resolveMediaUrl(brand.seoOgMedia) ??
          this.resolveMediaUrl(brand.heroImage) ??
          this.resolveMediaUrl(brand.image),
      })),
      contentPages: contentPages.map((page) => ({
        key: page.key,
        seoCanonicalPath: page.seoCanonicalPath,
        seoNoIndex: page.seoNoIndex,
        updatedAt: page.updatedAt.toISOString(),
        imageUrl: this.resolveMediaUrl(page.seoOgMedia) ?? this.resolveMediaUrl(page.heroMedia),
      })),
    };
  }

  private resolveMediaUrl(
    media: { storageKey: string; deletedAt: Date | null } | null | undefined,
  ) {
    return media && !media.deletedAt ? this.publicMediaUrl.resolve(media.storageKey) : null;
  }
}
