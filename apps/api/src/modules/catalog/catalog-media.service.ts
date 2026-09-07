import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_MEDIA_LIMIT } from '../../config/media-storage';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UpdateProductMediaDto } from './dto/update-product-media.dto';
import {
  type CatalogUploadFile,
  LocalMediaStorageService,
} from './local-media-storage.service';
import { PublicMediaUrlService } from './public-media-url.service';

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value?.trim();

  return normalized ? normalized.slice(0, maxLength) : null;
}

@Injectable()
export class CatalogMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localMediaStorage: LocalMediaStorageService,
    private readonly publicMediaUrl: PublicMediaUrlService,
  ) {}

  async upload(file: CatalogUploadFile | undefined, dto: UploadMediaDto) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const stored = await this.localMediaStorage.storeImage(file);

    try {
      return await this.prisma.media.create({
        data: {
          storageKey: stored.storageKey,
          originalName: normalizeOptionalText(file.originalname, 255),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          altText: normalizeOptionalText(dto.altText, 255),
        },
      });
    } catch (error) {
      await this.localMediaStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async uploadForProduct(
    productId: string,
    file: CatalogUploadFile | undefined,
    dto: UploadMediaDto,
  ) {
    if (!file) throw new BadRequestException('Image file is required.');

    const [product, mediaCount] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.productMedia.count({ where: { productId } }),
    ]);
    if (!product) throw new NotFoundException('Product was not found.');
    if (mediaCount >= PRODUCT_MEDIA_LIMIT) {
      throw new BadRequestException(`A product can have at most ${PRODUCT_MEDIA_LIMIT} images.`);
    }

    const stored = await this.localMediaStorage.storeImage(file);

    try {
      const productMedia = await this.prisma.$transaction(async (transaction) => {
        const [lastMedia, primaryMedia] = await Promise.all([
          transaction.productMedia.findFirst({
            where: { productId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          }),
          transaction.productMedia.findFirst({
            where: { productId, isPrimary: true },
            select: { mediaId: true },
          }),
        ]);
        const media = await transaction.media.create({
          data: {
            storageKey: stored.storageKey,
            originalName: normalizeOptionalText(file.originalname, 255),
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            altText: normalizeOptionalText(dto.altText, 255),
          },
        });

        return transaction.productMedia.create({
          data: {
            productId,
            mediaId: media.id,
            altText: normalizeOptionalText(dto.altText, 255),
            sortOrder: (lastMedia?.sortOrder ?? -1) + 1,
            isPrimary: primaryMedia === null,
          },
          include: { media: true },
        });
      });

      return this.projectProductMedia(productMedia);
    } catch (error) {
      await this.localMediaStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async uploadForCategory(
    categoryId: string,
    file: CatalogUploadFile | undefined,
    dto: UploadMediaDto,
  ) {
    if (!file) throw new BadRequestException('Image file is required.');
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category was not found.');

    const stored = await this.localMediaStorage.storeImage(file);
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { id: true, imageId: true },
        });
        if (!current) throw new NotFoundException('Category was not found.');

        const media = await transaction.media.create({
          data: {
            storageKey: stored.storageKey,
            originalName: normalizeOptionalText(file.originalname, 255),
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            altText: normalizeOptionalText(dto.altText, 255),
          },
        });
        await transaction.category.update({
          where: { id: categoryId },
          data: { imageId: media.id },
        });

        const orphanedStorageKey = current.imageId
          ? await this.markMediaDeletedWhenOrphaned(transaction, current.imageId)
          : null;
        return { media, orphanedStorageKey };
      });

      if (result.orphanedStorageKey) {
        await this.localMediaStorage.delete(result.orphanedStorageKey).catch(() => undefined);
      }
      return {
        categoryId,
        image: {
          id: result.media.id,
          url: this.publicMediaUrl.resolve(result.media.storageKey),
          mimeType: result.media.mimeType,
          altText: result.media.altText,
        },
      };
    } catch (error) {
      await this.localMediaStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async removeCategoryImage(categoryId: string) {
    const orphanedStorageKey = await this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: { id: true, imageId: true },
      });
      if (!category) throw new NotFoundException('Category was not found.');
      if (!category.imageId) return null;

      await transaction.category.update({
        where: { id: categoryId },
        data: { imageId: null },
      });
      return this.markMediaDeletedWhenOrphaned(transaction, category.imageId);
    });

    if (orphanedStorageKey) {
      await this.localMediaStorage.delete(orphanedStorageKey).catch(() => undefined);
    }
    return { removed: true };
  }

  async updateProductMedia(
    productId: string,
    mediaId: string,
    dto: UpdateProductMediaDto,
  ) {
    const productMedia = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.productMedia.findUnique({
        where: { productId_mediaId: { productId, mediaId } },
        select: { mediaId: true },
      });
      if (!existing) throw new NotFoundException('Product image was not found.');

      if (dto.isPrimary === true) {
        await transaction.productMedia.updateMany({
          where: { productId, mediaId: { not: mediaId } },
          data: { isPrimary: false },
        });
      }

      return transaction.productMedia.update({
        where: { productId_mediaId: { productId, mediaId } },
        data: {
          altText: normalizeOptionalText(dto.altText, 255),
          isPrimary: dto.isPrimary,
          sortOrder: dto.sortOrder,
        },
        include: { media: true },
      });
    });

    return this.projectProductMedia(productMedia);
  }

  async reorderProductMedia(productId: string, mediaIds: string[]) {
    const current = await this.prisma.productMedia.findMany({
      where: { productId },
      select: { mediaId: true },
    });
    const currentIds = new Set(current.map(({ mediaId }) => mediaId));
    if (current.length !== mediaIds.length || mediaIds.some((mediaId) => !currentIds.has(mediaId))) {
      throw new BadRequestException('Image order must include every current product image once.');
    }

    await this.prisma.$transaction(
      mediaIds.map((mediaId, sortOrder) =>
        this.prisma.productMedia.update({
          where: { productId_mediaId: { productId, mediaId } },
          data: { sortOrder },
        }),
      ),
    );

    const ordered = await this.prisma.productMedia.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
      include: { media: true },
    });
    return ordered.map((item) => this.projectProductMedia(item));
  }

  async removeProductMedia(productId: string, mediaId: string) {
    const orphanedStorageKey = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.productMedia.findUnique({
        where: { productId_mediaId: { productId, mediaId } },
        include: { media: true },
      });
      if (!existing) throw new NotFoundException('Product image was not found.');

      await transaction.productMedia.delete({
        where: { productId_mediaId: { productId, mediaId } },
      });

      if (existing.isPrimary) {
        const nextPrimary = await transaction.productMedia.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
          select: { mediaId: true },
        });
        if (nextPrimary) {
          await transaction.productMedia.update({
            where: { productId_mediaId: { productId, mediaId: nextPrimary.mediaId } },
            data: { isPrimary: true },
          });
        }
      }

      const media = await transaction.media.findUnique({
        where: { id: mediaId },
        select: {
          storageKey: true,
          _count: {
            select: {
              productMedia: true,
              categoryImages: true,
              brandImages: true,
              countryImages: true,
              siteSettingsCatalogHero: true,
            },
          },
        },
      });
      if (!media || Object.values(media._count).some((count) => count > 0)) return null;

      await transaction.media.update({
        where: { id: mediaId },
        data: { deletedAt: new Date() },
      });
      return media.storageKey;
    });

    if (orphanedStorageKey) {
      await this.localMediaStorage.delete(orphanedStorageKey).catch(() => undefined);
    }
    return { removed: true };
  }

  private projectProductMedia<T extends {
    altText: string | null;
    isPrimary: boolean;
    mediaId: string;
    sortOrder: number;
    media: {
      altText: string | null;
      height: number | null;
      mimeType: string;
      originalName: string | null;
      sizeBytes: number;
      storageKey: string;
      width: number | null;
    };
  }>(item: T) {
    return {
      id: item.mediaId,
      url: this.publicMediaUrl.resolve(item.media.storageKey),
      altText: item.altText ?? item.media.altText,
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
      mimeType: item.media.mimeType,
      originalName: item.media.originalName,
      sizeBytes: item.media.sizeBytes,
      width: item.media.width,
      height: item.media.height,
    };
  }

  private async markMediaDeletedWhenOrphaned(
    transaction: Pick<PrismaService, 'media'>,
    mediaId: string,
  ): Promise<string | null> {
    const media = await transaction.media.findUnique({
      where: { id: mediaId },
      select: {
        storageKey: true,
        _count: {
          select: {
            productMedia: true,
            categoryImages: true,
            brandImages: true,
            countryImages: true,
            siteSettingsCatalogHero: true,
          },
        },
      },
    });
    if (!media || Object.values(media._count).some((count) => count > 0)) return null;

    await transaction.media.update({
      where: { id: mediaId },
      data: { deletedAt: new Date() },
    });
    return media.storageKey;
  }
}
