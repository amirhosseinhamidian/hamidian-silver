import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListSupplierCreditsQueryDto } from './dto/list-supplier-credits-query.dto';

@Injectable()
export class SupplierCreditsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListSupplierCreditsQueryDto) {
    return this.prisma.supplierCredit.findMany({
      where: {
        status: query.status,
        supplierIdSnapshot: query.supplierId,
        orderId: query.orderId,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            productNameSnapshot: true,
            variantNameSnapshot: true,
            skuSnapshot: true,
          },
        },
        returnItem: {
          select: {
            id: true,
            returnId: true,
            quantity: true,
            disposition: true,
          },
        },
        createdBy: {
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

  async get(creditId: string) {
    const credit = await this.prisma.supplierCredit.findUnique({
      where: {
        id: creditId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        orderItem: true,
        returnItem: {
          include: {
            orderReturn: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!credit) {
      throw new NotFoundException('Supplier credit was not found.');
    }

    return credit;
  }
}
