import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, SizeMode } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateProductVariantDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';
import { CreateSizeGroupDto } from './dto/create-size-group.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { UpdateSizeGroupDto } from './dto/update-size-group.dto';

@Injectable()
export class CatalogVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSizeGroup(dto: CreateSizeGroupDto) {
    const data = this.normalizeSizeGroup(dto);
    try {
      return await this.prisma.sizeGroup.create({
        data: {
          ...data,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      this.throwSizeGroupConflict(error);
    }
  }

  listSizeGroups() {
    return this.prisma.sizeGroup.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async updateSizeGroup(groupId: string, dto: UpdateSizeGroupDto) {
    const normalized = this.normalizeSizeGroup(dto, true);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const group = await transaction.sizeGroup.findFirst({
          where: { id: groupId, deletedAt: null },
          select: { id: true, isActive: true },
        });
        if (!group) throw new NotFoundException('Size group was not found.');

        if (group.isActive && dto.isActive === false) {
          const activeSizeCount = await transaction.size.count({
            where: { groupId, isActive: true, deletedAt: null },
          });
          if (activeSizeCount > 0) {
            throw new ConflictException('A size group with active sizes cannot be deactivated.');
          }
        }

        return transaction.sizeGroup.update({
          where: { id: groupId },
          data: {
            ...normalized,
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          },
        });
      });
    } catch (error) {
      this.throwSizeGroupConflict(error);
    }
  }

  async createSize(dto: CreateSizeDto) {
    const code = dto.code.trim();
    const label = dto.label.trim();
    if (!code || !label) throw new BadRequestException('Size code and label are required.');

    try {
      const group = await this.prisma.sizeGroup.findFirst({
        where: { id: dto.groupId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Size group was not found or is inactive.');

      return await this.prisma.size.create({
        data: {
          groupId: dto.groupId,
          code,
          label,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
        include: { group: true },
      });
    } catch (error) {
      this.throwSizeConflict(error);
    }
  }

  listSizes() {
    return this.prisma.size.findMany({
      where: { deletedAt: null },
      orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { label: 'asc' }],
      include: { group: true },
    });
  }

  async updateSize(sizeId: string, dto: UpdateSizeDto) {
    if (dto.code !== undefined && !dto.code.trim()) {
      throw new BadRequestException('Size code cannot be empty.');
    }
    if (dto.label !== undefined && !dto.label.trim()) {
      throw new BadRequestException('Size label cannot be empty.');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const size = await transaction.size.findFirst({
          where: { id: sizeId, deletedAt: null },
          select: { id: true, groupId: true, isActive: true },
        });
        if (!size) throw new NotFoundException('Size was not found.');

        if (dto.groupId && dto.groupId !== size.groupId) {
          const [group, variantCount] = await Promise.all([
            transaction.sizeGroup.findFirst({
              where: { id: dto.groupId, isActive: true, deletedAt: null },
              select: { id: true },
            }),
            transaction.productVariant.count({ where: { sizeId, deletedAt: null } }),
          ]);
          if (!group) throw new NotFoundException('Size group was not found or is inactive.');
          if (variantCount > 0) {
            throw new ConflictException('A size used by product variants cannot change groups.');
          }
        }

        if (size.isActive && dto.isActive === false) {
          const activeVariantCount = await transaction.productVariant.count({
            where: { sizeId, isActive: true, deletedAt: null },
          });
          if (activeVariantCount > 0) {
            throw new ConflictException('A size used by active variants cannot be deactivated.');
          }
        }

        return transaction.size.update({
          where: { id: sizeId },
          data: {
            groupId: dto.groupId,
            code: dto.code?.trim(),
            label: dto.label?.trim(),
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          },
          include: { group: true },
        });
      });
    } catch (error) {
      this.throwSizeConflict(error);
    }
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    const sku = dto.sku.trim();
    if (!sku) throw new BadRequestException('SKU cannot be empty.');

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { id: true, sizeMode: true, salePriceToman: true, compareAtPriceToman: true },
        });
        if (!product) throw new NotFoundException('Product was not found.');

        await this.validateSizeAssignment(
          transaction,
          product.id,
          product.sizeMode,
          dto.sizeId ?? null,
        );
        this.validateVariantPrice(
          dto.salePriceToman ?? product.salePriceToman,
          dto.compareAtPriceToman ?? product.compareAtPriceToman,
        );

        return transaction.productVariant.create({
          data: {
            productId,
            sku,
            name: dto.name?.trim(),
            sizeId: dto.sizeId,
            weightGrams: dto.weightGrams,
            salePriceToman: dto.salePriceToman,
            compareAtPriceToman: dto.compareAtPriceToman,
            isActive: dto.isActive ?? true,
          },
          include: { size: { include: { group: true } } },
        });
      });
    } catch (error) {
      this.throwVariantConflict(error);
    }
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto) {
    if (dto.sku !== undefined && !dto.sku.trim()) {
      throw new BadRequestException('SKU cannot be empty.');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const variant = await transaction.productVariant.findFirst({
          where: { id: variantId, productId, deletedAt: null },
          select: {
            id: true,
            sizeId: true,
            salePriceToman: true,
            compareAtPriceToman: true,
            isActive: true,
            product: {
              select: {
                id: true,
                sizeMode: true,
                status: true,
                salePriceToman: true,
                compareAtPriceToman: true,
              },
            },
          },
        });
        if (!variant) throw new NotFoundException('Product variant was not found.');

        const sizeId = dto.sizeId === undefined ? variant.sizeId : dto.sizeId;
        await this.validateSizeAssignment(
          transaction,
          variant.product.id,
          variant.product.sizeMode,
          sizeId,
          variant.id,
        );
        const salePriceToman =
          dto.salePriceToman === undefined ? variant.salePriceToman : dto.salePriceToman;
        const compareAtPriceToman =
          dto.compareAtPriceToman === undefined
            ? variant.compareAtPriceToman
            : dto.compareAtPriceToman;
        this.validateVariantPrice(
          salePriceToman ?? variant.product.salePriceToman,
          compareAtPriceToman ?? variant.product.compareAtPriceToman,
        );

        if (
          variant.isActive &&
          dto.isActive === false &&
          variant.product.status === ProductStatus.ACTIVE
        ) {
          const otherActiveVariants = await transaction.productVariant.count({
            where: {
              productId,
              id: { not: variantId },
              isActive: true,
              deletedAt: null,
            },
          });
          if (otherActiveVariants === 0) {
            throw new ConflictException(
              'A published product must keep at least one active variant.',
            );
          }
        }

        return transaction.productVariant.update({
          where: { id: variantId },
          data: {
            sku: dto.sku?.trim(),
            name: dto.name === undefined ? undefined : dto.name?.trim() || null,
            sizeId: dto.sizeId,
            weightGrams: dto.weightGrams,
            salePriceToman: dto.salePriceToman,
            compareAtPriceToman: dto.compareAtPriceToman,
            isActive: dto.isActive,
          },
          include: { size: { include: { group: true } } },
        });
      });
    } catch (error) {
      this.throwVariantConflict(error);
    }
  }

  private async validateSizeAssignment(
    transaction: Pick<PrismaService, 'size' | 'productVariant'>,
    productId: string,
    sizeMode: SizeMode,
    sizeId: string | null,
    ignoredVariantId?: string,
  ) {
    if (sizeMode === SizeMode.SIZED && !sizeId) {
      throw new BadRequestException('Sized products require a size for every variant.');
    }
    if (sizeMode !== SizeMode.SIZED && sizeId) {
      throw new BadRequestException('Only sized products can assign sizes to variants.');
    }
    if (!sizeId) return;

    const size = await transaction.size.findFirst({
      where: {
        id: sizeId,
        isActive: true,
        deletedAt: null,
        group: { isActive: true, deletedAt: null },
      },
      select: { id: true, groupId: true },
    });
    if (!size) throw new NotFoundException('Size was not found or is inactive.');

    const existingVariant = await transaction.productVariant.findFirst({
      where: {
        productId,
        id: ignoredVariantId ? { not: ignoredVariantId } : undefined,
        sizeId: { not: null },
        deletedAt: null,
      },
      select: { size: { select: { groupId: true } } },
    });
    if (existingVariant?.size && existingVariant.size.groupId !== size.groupId) {
      throw new BadRequestException('All sized variants of a product must use one size group.');
    }
  }

  private validateVariantPrice(salePriceToman: number | null, compareAtPriceToman: number | null) {
    if (salePriceToman === null) {
      throw new BadRequestException('A variant or its product must have a sale price.');
    }
    if (compareAtPriceToman !== null && compareAtPriceToman <= salePriceToman) {
      throw new BadRequestException('Variant compare price must be greater than its sale price.');
    }
  }

  private normalizeSizeGroup(dto: CreateSizeGroupDto): {
    code: string;
    name: string;
    selectionLabel: string;
    cartLabel: string;
  };
  private normalizeSizeGroup(
    dto: UpdateSizeGroupDto,
    partial: true,
  ): {
    code?: string;
    name?: string;
    selectionLabel?: string;
    cartLabel?: string;
  };
  private normalizeSizeGroup(dto: CreateSizeGroupDto | UpdateSizeGroupDto, partial = false) {
    const normalize = (value: string | undefined, field: string) => {
      if (value === undefined && partial) return undefined;
      const normalized = value?.trim();
      if (!normalized) throw new BadRequestException(`${field} is required.`);
      return normalized;
    };
    return {
      code: normalize(dto.code, 'Size group code')?.toUpperCase(),
      name: normalize(dto.name, 'Size group name'),
      selectionLabel: normalize(dto.selectionLabel, 'Size group selection label'),
      cartLabel: normalize(dto.cartLabel, 'Size group cart label'),
    };
  }

  private throwSizeGroupConflict(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException('A size group with this code already exists.');
    }
    throw error;
  }

  private throwSizeConflict(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException('A size with this code already exists.');
    }
    throw error;
  }

  private throwVariantConflict(error: unknown): never {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException('SKU or product size is already assigned to another variant.');
    }
    throw error;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
