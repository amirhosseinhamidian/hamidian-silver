import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SeoRedirectEntityType } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { PERMISSION_CODES, type PermissionCode } from '../authorization/rbac.constants';
import { recordSeoSlugChange } from '../seo/seo-redirects.service';
import { readActiveCategoryProductCounts } from './catalog-category-counts';
import { catalogHierarchyTransaction } from './catalog-hierarchy-transaction';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryMergeResultDto, MergeCategoryDto } from './dto/merge-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PublicMediaUrlService } from './public-media-url.service';

const categoryInclude = {
  parent: { select: { id: true, name: true } },
  image: true,
  featuredImage: true,
  heroMobileImage: true,
  seoOgMedia: true,
  _count: {
    select: {
      children: { where: { deletedAt: null } },
      products: true,
    },
  },
} as const;

@Injectable()
export class CatalogCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim();
    if (!name || !slug) throw new BadRequestException('Category name and slug are required.');

    try {
      const category = await catalogHierarchyTransaction(this.prisma, async (transaction) => {
        if (dto.parentId) await this.requireActiveParent(transaction, dto.parentId);
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        if (dto.seoOgMediaId) await this.requireImageMedia(transaction, dto.seoOgMediaId);

        return transaction.category.create({
          data: {
            name,
            slug,
            description: this.optionalText(dto.description),
            seoTitle: this.optionalText(dto.seoTitle),
            seoDescription: this.optionalText(dto.seoDescription),
            seoCanonicalPath: this.optionalText(dto.seoCanonicalPath),
            seoNoIndex: dto.seoNoIndex ?? false,
            seoOgMediaId: dto.seoOgMediaId,
            parentId: dto.parentId,
            imageId: dto.imageId,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
          },
          include: categoryInclude,
        });
      });
      return this.project(category);
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async list() {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        include: categoryInclude,
      }),
      readActiveCategoryProductCounts(this.prisma),
    ]);
    return categories.map((category) => ({
      ...this.project(category),
      activeProductCount: counts.get(category.id)?.activeProductCount ?? 0,
      activeSubtreeProductCount: counts.get(category.id)?.activeSubtreeProductCount ?? 0,
    }));
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Category name cannot be empty.');
    }
    if (dto.slug !== undefined && !dto.slug.trim()) {
      throw new BadRequestException('Category slug cannot be empty.');
    }
    if (dto.parentId?.toLowerCase() === categoryId.toLowerCase()) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    try {
      const category = await catalogHierarchyTransaction(this.prisma, async (transaction) => {
        const current = await transaction.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { id: true, slug: true, isActive: true, parentId: true },
        });
        if (!current) throw new NotFoundException('Category was not found.');

        const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;
        if (parentId) {
          if (parentId !== current.parentId || dto.isActive === true) {
            await this.requireActiveParent(transaction, parentId);
          }
          if (parentId !== current.parentId) {
            await this.assertNoCycle(transaction, categoryId, parentId);
          }
        }
        if (dto.imageId) await this.requireMedia(transaction, dto.imageId);
        if (dto.seoOgMediaId) await this.requireImageMedia(transaction, dto.seoOgMediaId);

        if (current.isActive && dto.isActive === false) {
          const activeChildren = await transaction.category.count({
            where: { parentId: categoryId, isActive: true, deletedAt: null },
          });
          if (activeChildren > 0) {
            throw new ConflictException('A category with active children cannot be deactivated.');
          }
        }

        const nextSlug = dto.slug?.trim();
        const category = await transaction.category.update({
          where: { id: categoryId },
          data: {
            name: dto.name?.trim(),
            slug: nextSlug,
            description:
              dto.description === undefined ? undefined : this.optionalText(dto.description),
            seoTitle: dto.seoTitle === undefined ? undefined : this.optionalText(dto.seoTitle),
            seoDescription:
              dto.seoDescription === undefined ? undefined : this.optionalText(dto.seoDescription),
            seoCanonicalPath:
              dto.seoCanonicalPath === undefined
                ? undefined
                : this.optionalText(dto.seoCanonicalPath),
            seoNoIndex: dto.seoNoIndex,
            seoOgMediaId: dto.seoOgMediaId,
            parentId: dto.parentId,
            imageId: dto.imageId,
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          },
          include: categoryInclude,
        });

        if (nextSlug && nextSlug !== current.slug) {
          await recordSeoSlugChange(
            transaction,
            SeoRedirectEntityType.CATEGORY,
            categoryId,
            current.slug,
            nextSlug,
          );
        }

        return category;
      });
      return this.project(category);
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async archive(categoryId: string) {
    return catalogHierarchyTransaction(this.prisma, async (transaction) => {
      const category = await transaction.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: {
          id: true,
          _count: { select: { children: { where: { deletedAt: null } }, products: true } },
        },
      });
      if (!category) throw new NotFoundException('Category was not found.');
      if (category._count.children > 0) {
        throw new ConflictException('A category with child categories cannot be archived.');
      }
      if (category._count.products > 0) {
        throw new ConflictException('A category assigned to products cannot be archived.');
      }

      await transaction.category.update({
        where: { id: categoryId },
        data: { isActive: false, deletedAt: new Date() },
      });
      return { archived: true };
    });
  }

  async merge(
    categoryId: string,
    dto: MergeCategoryDto,
    permissions: readonly PermissionCode[],
  ): Promise<CategoryMergeResultDto> {
    const { targetCategoryId } = dto;
    if (categoryId.toLowerCase() === targetCategoryId.toLowerCase()) {
      throw new BadRequestException('A category cannot be merged into itself.');
    }

    return catalogHierarchyTransaction(this.prisma, async (transaction) => {
      const [source, target] = await Promise.all([
        transaction.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { slug: true },
        }),
        transaction.category.findFirst({
          where: { id: targetCategoryId, isActive: true, deletedAt: null },
          select: { slug: true },
        }),
      ]);
      if (!source) throw new NotFoundException('Category was not found.');
      if (!target) throw new NotFoundException('Merge target was not found or is inactive.');
      await this.assertNoCycle(transaction, categoryId, targetCategoryId);
      await this.requireMergePermissions(transaction, categoryId, permissions);

      const children = { parentId: categoryId, deletedAt: null };
      const [childCount, sourceProductCount, targetProductCount, sharedProductCount] =
        await Promise.all([
          transaction.category.count({ where: children }),
          transaction.productCategory.count({ where: { categoryId } }),
          transaction.productCategory.count({ where: { categoryId: targetCategoryId } }),
          transaction.productCategory.count({
            where: {
              categoryId,
              product: { categories: { some: { categoryId: targetCategoryId } } },
            },
          }),
        ]);
      const result = {
        merged: dto.dryRun === false,
        childCount,
        sourceProductCount,
        targetProductCount,
        sharedProductCount,
        sourcePath: `/categories/${source.slug}`,
        targetPath: `/categories/${target.slug}`,
      };
      if (!result.merged) return result;

      await this.transferCategoryReferences(transaction, categoryId, targetCategoryId);
      await transaction.category.updateMany({
        where: children,
        data: { parentId: targetCategoryId },
      });
      await transaction.category.updateMany({
        where: { seoCanonicalPath: result.sourcePath, deletedAt: null },
        data: { seoCanonicalPath: result.targetPath },
      });
      await recordSeoSlugChange(
        transaction,
        SeoRedirectEntityType.CATEGORY,
        targetCategoryId,
        source.slug,
        target.slug,
      );
      // Historical sources must resolve against the active target after the source is archived.
      await transaction.seoRedirect.updateMany({
        where: { entityType: SeoRedirectEntityType.CATEGORY, entityId: categoryId },
        data: { entityId: targetCategoryId, destinationPath: result.targetPath },
      });
      await transaction.category.update({
        where: { id: categoryId },
        data: { isActive: false, deletedAt: new Date() },
      });
      return attachHumanAuditEvent(result, {
        title: 'ادغام دسته‌بندی',
        operationType: 'UPDATE',
        entityName: result.sourcePath,
        changes: [
          {
            field: 'categoryPath',
            label: 'مسیر دسته‌بندی',
            before: result.sourcePath,
            after: result.targetPath,
          },
        ],
      });
    });
  }

  private async requireMergePermissions(
    transaction: Prisma.TransactionClient,
    sourceId: string,
    permissions: readonly PermissionCode[],
  ) {
    if (
      !permissions.includes(PERMISSION_CODES.CMS_WRITE) &&
      (await transaction.guideArticleCategory.count({ where: { categoryId: sourceId } })) > 0
    ) {
      throw new ForbiddenException('Merging this category requires guide editing permission.');
    }
    if (!permissions.includes(PERMISSION_CODES.SETTINGS_WRITE)) {
      const [feature, navigation] = await Promise.all([
        transaction.homepageFeaturedCategory.findUnique({ where: { categoryId: sourceId } }),
        transaction.siteSettings.count({ where: { headerCategoryIds: { has: sourceId } } }),
      ]);
      if (feature || navigation > 0) {
        throw new ForbiddenException('Merging this category requires site settings permission.');
      }
    }
  }

  private async transferCategoryReferences(
    transaction: Prisma.TransactionClient,
    sourceId: string,
    targetId: string,
  ) {
    await transaction.$executeRaw`
      INSERT INTO "product_categories" ("productId", "categoryId", "assignedAt")
      SELECT "productId", ${targetId}::uuid, "assignedAt"
      FROM "product_categories" WHERE "categoryId" = ${sourceId}::uuid
      ON CONFLICT ("productId", "categoryId") DO NOTHING
    `;
    await transaction.product.updateMany({
      where: { primaryCategoryId: sourceId },
      data: { primaryCategoryId: targetId },
    });
    await transaction.productCategory.deleteMany({ where: { categoryId: sourceId } });

    await transaction.$executeRaw`
      INSERT INTO "guide_article_categories" ("articleId", "categoryId")
      SELECT "articleId", ${targetId}::uuid
      FROM "guide_article_categories" WHERE "categoryId" = ${sourceId}::uuid
      ON CONFLICT ("articleId", "categoryId") DO NOTHING
    `;
    await transaction.guideArticleCategory.deleteMany({ where: { categoryId: sourceId } });
    await transaction.supplierSourceCategory.updateMany({
      where: { catalogCategoryId: sourceId },
      data: { catalogCategoryId: targetId },
    });

    const targetFeature = await transaction.homepageFeaturedCategory.findUnique({
      where: { categoryId: targetId },
      select: { categoryId: true },
    });
    if (targetFeature) {
      await transaction.homepageFeaturedCategory.deleteMany({ where: { categoryId: sourceId } });
    } else {
      await transaction.homepageFeaturedCategory.updateMany({
        where: { categoryId: sourceId },
        data: { categoryId: targetId },
      });
    }
    const settings = await transaction.siteSettings.findMany({
      where: { headerCategoryIds: { has: sourceId } },
      select: { id: true, headerCategoryIds: true },
    });
    for (const { id, headerCategoryIds } of settings) {
      await transaction.siteSettings.update({
        where: { id },
        data: {
          headerCategoryIds: [
            ...new Set(headerCategoryIds.map((item) => (item === sourceId ? targetId : item))),
          ],
        },
      });
    }
  }

  private async requireActiveParent(
    transaction: Pick<PrismaService, 'category'>,
    parentId: string,
  ) {
    const parent = await transaction.category.findFirst({
      where: { id: parentId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Parent category was not found or is inactive.');
  }

  private async requireMedia(transaction: Pick<PrismaService, 'media'>, mediaId: string) {
    const media = await transaction.media.findFirst({
      where: { id: mediaId, deletedAt: null },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('Media was not found.');
  }

  private async requireImageMedia(transaction: Pick<PrismaService, 'media'>, mediaId: string) {
    const media = await transaction.media.findFirst({
      where: { id: mediaId, deletedAt: null, mimeType: { startsWith: 'image/' } },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('SEO social image was not found.');
  }

  private async assertNoCycle(
    transaction: Pick<PrismaService, 'category'>,
    categoryId: string,
    candidateParentId: string,
  ) {
    const visited = new Set<string>();
    const sourceId = categoryId.toLowerCase();
    let cursor: string | null = candidateParentId.toLowerCase();

    while (cursor) {
      if (cursor === sourceId) {
        throw new BadRequestException('Category parent selection would create a cycle.');
      }
      if (visited.has(cursor)) {
        throw new ConflictException('The existing category tree contains a cycle.');
      }
      visited.add(cursor);
      const parent: { parentId: string | null } | null = await transaction.category.findFirst({
        where: { id: cursor, deletedAt: null },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private optionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value?.trim() || null;
  }

  private project<
    T extends {
      _count: { children: number; products: number };
      image: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
      featuredImage: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
      heroMobileImage: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
      seoOgMedia: {
        id: string;
        storageKey: string;
        mimeType: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
    },
  >(category: T) {
    const { _count, image, featuredImage, heroMobileImage, seoOgMedia, ...categoryFields } =
      category;
    return {
      ...categoryFields,
      childCount: _count.children,
      productCount: _count.products,
      image: image
        ? {
            id: image.id,
            url: this.publicMediaUrl.resolve(image.storageKey),
            mimeType: image.mimeType,
            altText: image.altText,
            width: image.width,
            height: image.height,
          }
        : null,
      featuredImage: featuredImage
        ? {
            id: featuredImage.id,
            url: this.publicMediaUrl.resolve(featuredImage.storageKey),
            mimeType: featuredImage.mimeType,
            altText: featuredImage.altText,
            width: featuredImage.width,
            height: featuredImage.height,
          }
        : null,
      heroMobileImage: heroMobileImage
        ? {
            id: heroMobileImage.id,
            url: this.publicMediaUrl.resolve(heroMobileImage.storageKey),
            mimeType: heroMobileImage.mimeType,
            altText: heroMobileImage.altText,
            width: heroMobileImage.width,
            height: heroMobileImage.height,
          }
        : null,
      seoOgMedia: seoOgMedia
        ? {
            id: seoOgMedia.id,
            url: this.publicMediaUrl.resolve(seoOgMedia.storageKey),
            mimeType: seoOgMedia.mimeType,
            altText: seoOgMedia.altText,
            width: seoOgMedia.width,
            height: seoOgMedia.height,
          }
        : null,
    };
  }

  private throwUniqueConflict(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('A category with this slug already exists.');
    }
    throw error;
  }
}
