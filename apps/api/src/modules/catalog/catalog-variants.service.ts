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
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateSizeDto } from './dto/update-size.dto';

@Injectable()
export class CatalogVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSize(dto: CreateSizeDto) {
    const code = dto.code.trim();
    const label = dto.label.trim();
    if (!code || !label) throw new BadRequestException('Size code and label are required.');

    try {
      return await this.prisma.size.create({
        data: {
          code,
          label,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      this.throwSizeConflict(error);
    }
  }

  listSizes() {
    return this.prisma.size.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
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
          select: { id: true, isActive: true },
        });
        if (!size) throw new NotFoundException('Size was not found.');

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
            code: dto.code?.trim(),
            label: dto.label?.trim(),
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
          },
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
          select: { id: true, sizeMode: true },
        });
        if (!product) throw new NotFoundException('Product was not found.');

        await this.validateSizeAssignment(transaction, product.sizeMode, dto.sizeId ?? null);

        return transaction.productVariant.create({
          data: {
            productId,
            sku,
            name: dto.name?.trim(),
            sizeId: dto.sizeId,
            weightGrams: dto.weightGrams,
            isActive: dto.isActive ?? true,
          },
          include: { size: true },
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
            isActive: true,
            product: { select: { sizeMode: true, status: true } },
          },
        });
        if (!variant) throw new NotFoundException('Product variant was not found.');

        const sizeId = dto.sizeId === undefined ? variant.sizeId : dto.sizeId;
        await this.validateSizeAssignment(transaction, variant.product.sizeMode, sizeId);

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
            isActive: dto.isActive,
          },
          include: { size: true },
        });
      });
    } catch (error) {
      this.throwVariantConflict(error);
    }
  }

  private async validateSizeAssignment(
    transaction: Pick<PrismaService, 'size'>,
    sizeMode: SizeMode,
    sizeId: string | null,
  ) {
    if (sizeMode === SizeMode.SIZED && !sizeId) {
      throw new BadRequestException('Sized products require a size for every variant.');
    }
    if (sizeMode !== SizeMode.SIZED && sizeId) {
      throw new BadRequestException('Only sized products can assign sizes to variants.');
    }
    if (!sizeId) return;

    const size = await transaction.size.findFirst({
      where: { id: sizeId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!size) throw new NotFoundException('Size was not found or is inactive.');
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
