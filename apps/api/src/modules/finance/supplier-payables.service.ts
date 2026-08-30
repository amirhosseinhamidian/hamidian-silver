import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupplierPayableStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListSupplierPayablesQueryDto } from './dto/list-supplier-payables-query.dto';
import { MarkSupplierPayablePaidDto } from './dto/mark-supplier-payable-paid.dto';

@Injectable()
export class SupplierPayablesService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListSupplierPayablesQueryDto) {
    return this.prisma.supplierPayable.findMany({
      where: {
        status: query.status,
        supplierIdSnapshot: query.supplierId,
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
            status: true,
            paidAt: true,
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
        paidBy: {
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

  async summary() {
    const groups = await this.prisma.supplierPayable.groupBy({
      by: ['supplierIdSnapshot', 'supplierNameSnapshot', 'status'],
      _sum: {
        amountToman: true,
      },
      _count: {
        _all: true,
      },
      _max: {
        createdAt: true,
      },
    });

    const bySupplier = new Map<
      string,
      {
        supplierIdSnapshot: string;
        supplierNameSnapshot: string;
        latestNameAt: Date;
        openAmountToman: number;
        openCount: number;
        paidAmountToman: number;
        paidCount: number;
      }
    >();

    for (const group of groups) {
      const existing = bySupplier.get(group.supplierIdSnapshot);
      const groupCreatedAt = group._max.createdAt ?? new Date(0);
      const current = existing ?? {
        supplierIdSnapshot: group.supplierIdSnapshot,
        supplierNameSnapshot: group.supplierNameSnapshot,
        latestNameAt: groupCreatedAt,
        openAmountToman: 0,
        openCount: 0,
        paidAmountToman: 0,
        paidCount: 0,
      };

      if (groupCreatedAt > current.latestNameAt) {
        current.supplierNameSnapshot = group.supplierNameSnapshot;
        current.latestNameAt = groupCreatedAt;
      }

      const amount = group._sum.amountToman ?? 0;
      const count = group._count._all;

      if (group.status === SupplierPayableStatus.OPEN) {
        current.openAmountToman += amount;
        current.openCount += count;
      } else {
        current.paidAmountToman += amount;
        current.paidCount += count;
      }

      bySupplier.set(group.supplierIdSnapshot, current);
    }

    return [...bySupplier.values()]
      .map(({ latestNameAt: _latestNameAt, ...row }) => ({
        ...row,
        totalAmountToman: row.openAmountToman + row.paidAmountToman,
        totalCount: row.openCount + row.paidCount,
      }))
      .sort((a, b) => b.openAmountToman - a.openAmountToman);
  }

  async markPaid(payableId: string, actorUserId: string, dto: MarkSupplierPayablePaidDto) {
    return this.prisma.$transaction(async (transaction) => {
      const payable = await transaction.supplierPayable.findUnique({
        where: {
          id: payableId,
        },
      });

      if (!payable) {
        throw new NotFoundException('Supplier payable was not found.');
      }

      if (payable.status === SupplierPayableStatus.PAID) {
        return payable;
      }

      if (payable.settlementId) {
        throw new ConflictException(
          'Supplier payable belongs to a settlement and must be paid through that settlement.',
        );
      }

      if (payable.status !== SupplierPayableStatus.OPEN) {
        throw new ConflictException('Supplier payable cannot be settled from its current status.');
      }

      return transaction.supplierPayable.update({
        where: {
          id: payable.id,
        },
        data: {
          status: SupplierPayableStatus.PAID,
          paidByUserId: actorUserId,
          paidAt: new Date(),
          paymentReference: dto.paymentReference,
          settlementNote: dto.note,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          paidBy: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }
}
