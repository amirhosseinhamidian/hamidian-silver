import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { HomepageHeroPlacement, ProductStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { AdminHomepageDto } from './dto/admin-homepage.dto';
import { PublicHomepageDto, PublicHomepageHeroSlideDto } from './dto/public-homepage.dto';
import { UpdateHomepageDto, UpdateHomepageHeroSlideDto } from './dto/update-homepage.dto';

const SITE_SETTINGS_ID = 'site';

function nullableText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
    private readonly publicMediaUrlService: PublicMediaUrlService,
  ) {}

  async getPublicHomepage(): Promise<PublicHomepageDto> {
    const [heroSlides, categorySelections, popularSelections, newProducts, brands] =
      await Promise.all([
        this.prisma.homepageHeroSlide.findMany({
          where: { isActive: true },
          orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
          include: { media: true },
        }),
        this.prisma.homepageFeaturedCategory.findMany({
          where: {
            category: { isActive: true, deletedAt: null },
          },
          orderBy: { priority: 'asc' },
          select: { priority: true, categoryId: true },
        }),
        this.prisma.homepagePopularProduct.findMany({
          where: {
            product: { status: ProductStatus.ACTIVE, deletedAt: null },
          },
          orderBy: { priority: 'asc' },
          select: { product: { select: { slug: true } } },
        }),
        this.catalogService.listPublicProducts({ page: 1, pageSize: 4 }),
        this.catalogService.listPublicBrands(),
      ]);

    const [categories, popularProducts] = await Promise.all([
      this.catalogService.listPublicCategories(),
      Promise.all(
        popularSelections.map(({ product }) => this.getPublicProductSummary(product.slug)),
      ),
    ]);
    const categoryById = new Map(categories.map((category) => [category.id, category] as const));
    const primaryHeroSlides = heroSlides
      .filter(({ placement }) => placement === HomepageHeroPlacement.PRIMARY)
      .flatMap((slide) => {
        const projected = this.projectPublicHeroSlide(slide);
        return projected ? [projected] : [];
      });
    const secondaryHeroRecord = heroSlides.find(
      ({ placement }) => placement === HomepageHeroPlacement.SECONDARY,
    );

    return {
      primaryHeroSlides,
      secondaryHero: secondaryHeroRecord ? this.projectPublicHeroSlide(secondaryHeroRecord) : null,
      newProducts: newProducts.items,
      featuredCategories: categorySelections.flatMap(({ categoryId, priority }) => {
        const category = categoryById.get(categoryId);
        return category ? [{ ...category, priority }] : [];
      }),
      popularProducts,
      featuredBrands: brands.slice(0, 8),
    };
  }

  async getAdminHomepage(): Promise<AdminHomepageDto> {
    const [slides, categories, products, settings] = await Promise.all([
      this.prisma.homepageHeroSlide.findMany({
        orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        include: { media: true },
      }),
      this.prisma.homepageFeaturedCategory.findMany({ orderBy: { priority: 'asc' } }),
      this.prisma.homepagePopularProduct.findMany({ orderBy: { priority: 'asc' } }),
      this.prisma.siteSettings.findUnique({
        where: { id: SITE_SETTINGS_ID },
        select: { updatedAt: true },
      }),
    ]);

    const projectSlide = (slide: (typeof slides)[number]) => ({
      id: slide.id,
      mediaId: slide.mediaId,
      media: {
        id: slide.media.id,
        url: slide.media.deletedAt
          ? null
          : this.publicMediaUrlService.resolve(slide.media.storageKey),
        mimeType: slide.media.mimeType,
        altText: slide.media.altText,
      },
      title: slide.title,
      subtitle: slide.subtitle,
      actionLabel: slide.actionLabel,
      actionHref: slide.actionHref,
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
    });

    return {
      primaryHeroSlides: slides
        .filter(({ placement }) => placement === HomepageHeroPlacement.PRIMARY)
        .map(projectSlide),
      secondaryHero: slides.find(({ placement }) => placement === HomepageHeroPlacement.SECONDARY)
        ? projectSlide(
            slides.find(({ placement }) => placement === HomepageHeroPlacement.SECONDARY)!,
          )
        : null,
      featuredCategories: categories.map(({ categoryId, priority }) => ({
        id: categoryId,
        priority,
      })),
      popularProducts: products.map(({ productId, priority }) => ({
        id: productId,
        priority,
      })),
      updatedAt: settings?.updatedAt.toISOString() ?? null,
    };
  }

  async updateHomepage(dto: UpdateHomepageDto, actorUserId: string): Promise<AdminHomepageDto> {
    this.validateUniqueSelections(dto);
    const slides = [
      ...dto.primaryHeroSlides.map((slide, index) => ({
        ...this.normalizeSlide(slide),
        placement: HomepageHeroPlacement.PRIMARY,
        sortOrder: index + 1,
      })),
      ...(dto.secondaryHero
        ? [
            {
              ...this.normalizeSlide(dto.secondaryHero),
              placement: HomepageHeroPlacement.SECONDARY,
              sortOrder: 1,
            },
          ]
        : []),
    ];

    await Promise.all([
      this.validateHeroMedia(slides.map(({ mediaId }) => mediaId)),
      this.validateCategories(dto.categoryIds),
      this.validateProducts(dto.popularProductIds),
    ]);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.homepageHeroSlide.deleteMany();
      await transaction.homepageFeaturedCategory.deleteMany();
      await transaction.homepagePopularProduct.deleteMany();

      if (slides.length > 0) {
        await transaction.homepageHeroSlide.createMany({ data: slides });
      }

      if (dto.categoryIds.length > 0) {
        await transaction.homepageFeaturedCategory.createMany({
          data: dto.categoryIds.map((categoryId, index) => ({
            categoryId,
            priority: index + 1,
          })),
        });
      }

      if (dto.popularProductIds.length > 0) {
        await transaction.homepagePopularProduct.createMany({
          data: dto.popularProductIds.map((productId, index) => ({
            productId,
            priority: index + 1,
          })),
        });
      }

      await transaction.siteSettings.upsert({
        where: { id: SITE_SETTINGS_ID },
        create: { id: SITE_SETTINGS_ID, updatedByUserId: actorUserId },
        update: { updatedByUserId: actorUserId },
      });
    });

    return this.getAdminHomepage();
  }

  private normalizeSlide(slide: UpdateHomepageHeroSlideDto) {
    const actionLabel = nullableText(slide.actionLabel);
    const actionHref = nullableText(slide.actionHref);

    if (Boolean(actionLabel) !== Boolean(actionHref)) {
      throw new BadRequestException('Hero action label and link must be provided together.');
    }

    if (actionHref && !this.isAllowedActionHref(actionHref)) {
      throw new BadRequestException('Hero action link must be an internal path or an HTTP URL.');
    }

    return {
      mediaId: slide.mediaId,
      title: nullableText(slide.title),
      subtitle: nullableText(slide.subtitle),
      actionLabel,
      actionHref,
      isActive: slide.isActive ?? true,
    };
  }

  private async getPublicProductSummary(slug: string) {
    const product = await this.catalogService.getPublicProduct(slug);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      salePriceToman: product.salePriceToman,
      compareAtPriceToman: product.compareAtPriceToman,
      sizeMode: product.sizeMode,
      brand: product.brand,
      categories: product.categories,
      primaryMedia: product.primaryMedia,
      availableQuantity: product.availableQuantity,
      isAvailable: product.isAvailable,
    };
  }

  private validateUniqueSelections(dto: UpdateHomepageDto): void {
    if (hasDuplicates(dto.categoryIds)) {
      throw new BadRequestException('Homepage categories must be unique.');
    }

    if (hasDuplicates(dto.popularProductIds)) {
      throw new BadRequestException('Homepage popular products must be unique.');
    }
  }

  private async validateHeroMedia(mediaIds: string[]): Promise<void> {
    const uniqueMediaIds = [...new Set(mediaIds)];
    if (uniqueMediaIds.length === 0) return;

    const media = await this.prisma.media.findMany({
      where: { id: { in: uniqueMediaIds }, deletedAt: null, mimeType: { startsWith: 'image/' } },
      select: { id: true },
    });

    if (media.length !== uniqueMediaIds.length) {
      throw new NotFoundException('One or more homepage hero images were not found.');
    }
  }

  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return;

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('One or more homepage categories were not found.');
    }
  }

  private async validateProducts(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: ProductStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more homepage products were not found.');
    }
  }

  private isAllowedActionHref(href: string): boolean {
    if (href.startsWith('/') && !href.startsWith('//')) return true;

    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private projectPublicHeroSlide(slide: {
    title: string | null;
    subtitle: string | null;
    actionLabel: string | null;
    actionHref: string | null;
    media: {
      storageKey: string;
      mimeType: string;
      altText: string | null;
      width: number | null;
      height: number | null;
      deletedAt: Date | null;
    };
  }): PublicHomepageHeroSlideDto | null {
    if (slide.media.deletedAt || !slide.media.mimeType.startsWith('image/')) return null;

    return {
      title: slide.title,
      subtitle: slide.subtitle,
      actionLabel: slide.actionLabel,
      actionHref: slide.actionHref,
      media: {
        url: this.publicMediaUrlService.resolve(slide.media.storageKey),
        mimeType: slide.media.mimeType,
        altText: slide.media.altText,
        width: slide.media.width,
        height: slide.media.height,
      },
    };
  }
}
