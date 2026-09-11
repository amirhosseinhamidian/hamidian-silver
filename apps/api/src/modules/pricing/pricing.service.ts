import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
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

  async getPricingCatalog() {
    const [products, platingRates, productHistory, platingHistory] = await Promise.all([
      this.prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          salePriceToman: true,
          compareAtPriceToman: true,
          suppliers: {
            where: {
              isActive: true,
              supplier: { isActive: true, deletedAt: null },
            },
            orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
            take: 1,
            select: {
              supplierPriceToman: true,
              isPreferred: true,
              supplier: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.platingRate.findMany({ orderBy: { type: 'asc' } }),
      this.prisma.productPriceHistory.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          changedBy: {
            select: { id: true, phone: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.platingRateHistory.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          platingRate: { select: { id: true, type: true } },
          changedBy: {
            select: { id: true, phone: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    return { products, platingRates, productHistory, platingHistory };
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
        compareAtPriceToman: true,
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
          compareAtPriceToman: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product was not found.');
      }

      const compareAtPriceToman =
        dto.compareAtPriceToman === undefined
          ? product.compareAtPriceToman
          : dto.compareAtPriceToman;

      if (compareAtPriceToman !== null && compareAtPriceToman <= dto.salePriceToman) {
        throw new BadRequestException('Compare-at price must be greater than sale price.');
      }

      if (
        product.salePriceToman === dto.salePriceToman &&
        product.compareAtPriceToman === compareAtPriceToman
      ) {
        const unchanged = await transaction.product.findUniqueOrThrow({
          where: {
            id: productId,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            salePriceToman: true,
            compareAtPriceToman: true,
          },
        });
        return attachHumanAuditEvent(unchanged, {
          title: `قیمت فروش ${unchanged.name} بدون تغییر باقی ماند.`,
          operationType: 'PRICE_CHANGE',
          entityName: unchanged.name,
          changes: [],
        });
      }

      await transaction.productPriceHistory.create({
        data: {
          productId,
          changedByUserId: actorUserId,
          previousPriceToman: product.salePriceToman,
          newPriceToman: dto.salePriceToman,
          previousCompareAtPriceToman: product.compareAtPriceToman,
          newCompareAtPriceToman: compareAtPriceToman,
          reason: dto.reason,
        },
      });

      const updated = await transaction.product.update({
        where: {
          id: productId,
        },
        data: {
          salePriceToman: dto.salePriceToman,
          compareAtPriceToman,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          salePriceToman: true,
          compareAtPriceToman: true,
        },
      });
      const previousPriceLabel =
        product.salePriceToman === null ? 'بدون قیمت' : `${product.salePriceToman} تومان`;
      const nextPriceLabel =
        updated.salePriceToman === null ? 'بدون قیمت' : `${updated.salePriceToman} تومان`;
      return attachHumanAuditEvent(updated, {
        title: `قیمت فروش ${updated.name} از ${previousPriceLabel} به ${nextPriceLabel} تغییر کرد.`,
        operationType: 'PRICE_CHANGE',
        entityName: updated.name,
        changes: [
          {
            field: 'salePriceToman',
            label: 'قیمت فروش',
            before: product.salePriceToman,
            after: updated.salePriceToman,
          },
          ...(product.compareAtPriceToman === updated.compareAtPriceToman
            ? []
            : [
                {
                  field: 'compareAtPriceToman',
                  label: 'قیمت قبل از تخفیف',
                  before: product.compareAtPriceToman,
                  after: updated.compareAtPriceToman,
                },
              ]),
        ],
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
