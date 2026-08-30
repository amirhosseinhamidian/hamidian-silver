import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SetProductSupplierDto } from './dto/set-product-supplier.dto';
import { SetSalePriceDto } from './dto/set-sale-price.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name,
        contactName: dto.contactName,
        phone: dto.phone,
        isActive: dto.isActive ?? true,
      },
    });
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

  async setProductSupplier(productId: string, supplierId: string, dto: SetProductSupplierDto) {
    return this.prisma.$transaction(async (transaction) => {
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

      if (dto.isPreferred) {
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
          isPreferred: dto.isPreferred ?? false,
          isActive: dto.isActive ?? true,
        },
        create: {
          productId,
          supplierId,
          supplierPriceToman: dto.supplierPriceToman,
          markupPercent: dto.markupPercent,
          isPreferred: dto.isPreferred ?? false,
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
}
