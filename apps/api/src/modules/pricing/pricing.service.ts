import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SetProductSupplierDto } from './dto/set-product-supplier.dto';
import { SetSalePriceDto } from './dto/set-sale-price.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createSupplier(dto: CreateSupplierDto) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException('Supplier code and name are required.');
    try {
      return await this.prisma.supplier.create({
        data: {
          code,
          name,
          contactName: dto.contactName?.trim() || undefined,
          phone: dto.phone?.trim() || undefined,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Another supplier already uses this code.');
      }
      throw error;
    }
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  getSupplierCatalog() {
    return Promise.all([
      this.prisma.supplier.findMany({
        where: { deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          salePriceToman: true,
          suppliers: {
            orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
            include: { supplier: true },
          },
        },
      }),
    ]).then(([suppliers, products]) => ({ suppliers, products }));
  }

  async updateSupplier(supplierId: string, dto: UpdateSupplierDto) {
    const code = dto.code?.trim().toUpperCase();
    const name = dto.name?.trim();
    const contactName = dto.contactName === null ? null : dto.contactName?.trim();
    const phone = dto.phone === null ? null : dto.phone?.trim();
    if (code === '' || name === '' || contactName === '' || phone === '') {
      throw new ConflictException('Supplier fields cannot be blank.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const supplier = await transaction.supplier.findFirst({
        where: { id: supplierId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new NotFoundException('Supplier was not found.');

      if (dto.isActive === false) {
        await transaction.productSupplier.updateMany({
          where: { supplierId, OR: [{ isActive: true }, { isPreferred: true }] },
          data: { isActive: false, isPreferred: false },
        });
      }

      try {
        return await transaction.supplier.update({
          where: { id: supplierId },
          data: {
            ...(code !== undefined ? { code } : {}),
            ...(name !== undefined ? { name } : {}),
            ...(contactName !== undefined ? { contactName } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException('Another supplier already uses this code.');
        }
        throw error;
      }
    });
  }

  async setProductSupplier(productId: string, supplierId: string, dto: SetProductSupplierDto) {
    return this.prisma.$transaction(async (transaction) => {
      const preferred = dto.isActive === false ? false : (dto.isPreferred ?? false);
      const [product, supplier] = await Promise.all([
        transaction.product.findFirst({
          where: {
            id: productId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        }),
        transaction.supplier.findFirst({
          where: {
            id: supplierId,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        }),
      ]);

      if (!product) {
        throw new NotFoundException('Product was not found.');
      }

      if (!supplier) {
        throw new NotFoundException('Supplier was not found.');
      }

      if (preferred) {
        await transaction.productSupplier.updateMany({
          where: {
            productId,
            isPreferred: true,
            supplierId: {
              not: supplierId,
            },
          },
          data: {
            isPreferred: false,
          },
        });
      }

      return transaction.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId,
            supplierId,
          },
        },
        update: {
          supplierPriceToman: dto.supplierPriceToman,
          markupPercent: dto.markupPercent,
          isPreferred: preferred,
          isActive: dto.isActive ?? true,
        },
        create: {
          productId,
          supplierId,
          supplierPriceToman: dto.supplierPriceToman,
          markupPercent: dto.markupPercent,
          isPreferred: preferred,
          isActive: dto.isActive ?? true,
        },
        include: {
          supplier: true,
        },
      });
    });
  }

  async getProductPricing(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        salePriceToman: true,
        suppliers: {
          where: {
            isActive: true,
            supplier: {
              isActive: true,
              deletedAt: null,
            },
          },
          orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
          include: {
            supplier: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product was not found.');
    }

    return product;
  }

  async setSalePrice(productId: string, dto: SetSalePriceDto, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: {
          id: productId,
          deletedAt: null,
        },
        select: {
          id: true,
          salePriceToman: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product was not found.');
      }

      if (product.salePriceToman === dto.salePriceToman) {
        return transaction.product.findUniqueOrThrow({
          where: {
            id: productId,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            salePriceToman: true,
          },
        });
      }

      await transaction.productPriceHistory.create({
        data: {
          productId,
          changedByUserId: actorUserId,
          previousPriceToman: product.salePriceToman,
          newPriceToman: dto.salePriceToman,
          reason: dto.reason,
        },
      });

      return transaction.product.update({
        where: {
          id: productId,
        },
        data: {
          salePriceToman: dto.salePriceToman,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          salePriceToman: true,
        },
      });
    });
  }

  async listPriceHistory(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product was not found.');
    }

    return this.prisma.productPriceHistory.findMany({
      where: {
        productId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        changedBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
