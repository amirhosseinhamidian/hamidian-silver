import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  PaymentRefundStatus,
  PaymentStatus,
  SupplierPayableStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BackfillFinanceSnapshotsDto } from './dto/backfill-finance-snapshots.dto';
import { FinancePeriodQueryDto } from './dto/finance-period-query.dto';
import { ListFinanceOrdersQueryDto } from './dto/list-finance-orders-query.dto';

type FinanceSnapshotOrderInput = {
  orderId: string;
  paidAt: Date;
  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  shippingTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;
  items: Array<{
    quantity: number;
    unitSupplierPriceToman: number | null | undefined;
  }>;
};

@Injectable()
export class OrderFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createSnapshot(transaction: Prisma.TransactionClient, input: FinanceSnapshotOrderInput) {
    const values = this.calculateSnapshot(input);

    return transaction.orderFinanceSnapshot.createMany({
      data: [
        {
          orderId: input.orderId,
          paidAt: input.paidAt,
          ...values,
        },
      ],
      skipDuplicates: true,
    });
  }

  async dashboard(query: FinancePeriodQueryDto) {
    const where = this.buildSnapshotWhere(query.from, query.to);
    const refundConfirmedAt = this.buildDateTimeFilter(query.from, query.to);
    const [finance, payableGroups, refunds] = await Promise.all([
      this.prisma.orderFinanceSnapshot.aggregate({
        where,
        _count: {
          _all: true,
        },
        _sum: {
          merchandiseRevenueToman: true,
          platingRevenueToman: true,
          discountToman: true,
          shippingChargedToman: true,
          taxToman: true,
          customerTotalToman: true,
          supplierCostToman: true,
          grossSalesToman: true,
          netSalesToman: true,
          grossMarginBeforeServiceCostsToman: true,
        },
      }),
      this.prisma.supplierPayable.groupBy({
        by: ['status'],
        _sum: {
          amountToman: true,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          status: PaymentRefundStatus.CONFIRMED,
          confirmedAt: refundConfirmedAt,
        },
        _sum: {
          amountToman: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    let openSupplierPayablesToman = 0;
    let openSupplierPayablesCount = 0;
    let paidSupplierPayablesToman = 0;
    let paidSupplierPayablesCount = 0;

    for (const group of payableGroups) {
      const amount = group._sum.amountToman ?? 0;
      const count = group._count._all;

      if (group.status === SupplierPayableStatus.OPEN) {
        openSupplierPayablesToman += amount;
        openSupplierPayablesCount += count;
      } else {
        paidSupplierPayablesToman += amount;
        paidSupplierPayablesCount += count;
      }
    }

    const successfulRefundToman = refunds._sum.amountToman ?? 0;
    const customerTotalToman = finance._sum.customerTotalToman ?? 0;

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      paidOrderCount: finance._count._all,
      merchandiseRevenueToman: finance._sum.merchandiseRevenueToman ?? 0,
      platingRevenueToman: finance._sum.platingRevenueToman ?? 0,
      discountToman: finance._sum.discountToman ?? 0,
      shippingChargedToman: finance._sum.shippingChargedToman ?? 0,
      taxToman: finance._sum.taxToman ?? 0,
      customerTotalToman,
      successfulRefundToman,
      successfulRefundCount: refunds._count._all,
      netCollectedRevenueToman: customerTotalToman - successfulRefundToman,
      supplierCostToman: finance._sum.supplierCostToman ?? 0,
      grossSalesToman: finance._sum.grossSalesToman ?? 0,
      netSalesToman: finance._sum.netSalesToman ?? 0,
      grossProfitBeforeServiceCostsToman: finance._sum.grossMarginBeforeServiceCostsToman ?? 0,
      openSupplierPayablesToman,
      openSupplierPayablesCount,
      paidSupplierPayablesToman,
      paidSupplierPayablesCount,
    };
  }

  listOrders(query: ListFinanceOrdersQueryDto) {
    return this.prisma.orderFinanceSnapshot.findMany({
      where: this.buildSnapshotWhere(query.from, query.to),
      take: query.limit ?? 50,
      orderBy: {
        paidAt: 'desc',
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            payment: {
              select: {
                status: true,
                amountToman: true,
                refundedAmountToman: true,
                refundAllocatedToman: true,
              },
            },
            user: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async getOrder(orderId: string) {
    const snapshot = await this.prisma.orderFinanceSnapshot.findUnique({
      where: {
        orderId,
      },
      include: {
        order: {
          include: {
            items: true,
            supplierPayables: {
              orderBy: {
                createdAt: 'asc',
              },
            },
            payment: {
              include: {
                refunds: {
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Order finance snapshot was not found.');
    }

    return snapshot;
  }

  async backfillMissing(dto: BackfillFinanceSnapshotsDto) {
    const orders = await this.prisma.order.findMany({
      where: {
        financeSnapshot: null,
        paidAt: {
          not: null,
        },
        payment: {
          is: {
            status: PaymentStatus.PAID,
          },
        },
      },
      take: dto.limit ?? 100,
      orderBy: {
        paidAt: 'asc',
      },
      include: {
        items: true,
      },
    });

    return this.prisma.$transaction(async (transaction) => {
      let created = 0;

      for (const order of orders) {
        if (!order.paidAt) {
          continue;
        }

        const result = await this.createSnapshot(transaction, {
          orderId: order.id,
          paidAt: order.paidAt,
          merchandiseTotalToman: order.merchandiseTotalToman,
          platingTotalToman: order.platingTotalToman,
          discountTotalToman: order.discountTotalToman,
          shippingTotalToman: order.shippingTotalToman,
          taxTotalToman: order.taxTotalToman,
          grandTotalToman: order.grandTotalToman,
          items: order.items,
        });

        created += result.count;
      }

      return {
        scanned: orders.length,
        created,
      };
    });
  }

  private calculateSnapshot(input: FinanceSnapshotOrderInput) {
    const amounts = [
      input.merchandiseTotalToman,
      input.platingTotalToman,
      input.discountTotalToman,
      input.shippingTotalToman,
      input.taxTotalToman,
      input.grandTotalToman,
    ];

    if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
      throw new BadRequestException('Order finance snapshot contains an invalid amount.');
    }

    let supplierCostToman = 0;

    for (const item of input.items) {
      const unitSupplierPriceToman = item.unitSupplierPriceToman ?? null;

      if (unitSupplierPriceToman === null) {
        continue;
      }

      const lineSupplierCost = unitSupplierPriceToman * item.quantity;

      if (!Number.isSafeInteger(lineSupplierCost) || lineSupplierCost < 0) {
        throw new BadRequestException('Supplier cost exceeds the supported range.');
      }

      supplierCostToman += lineSupplierCost;

      if (!Number.isSafeInteger(supplierCostToman)) {
        throw new BadRequestException('Supplier cost exceeds the supported range.');
      }
    }

    const grossSalesToman = input.merchandiseTotalToman + input.platingTotalToman;
    const netSalesToman = grossSalesToman - input.discountTotalToman;
    const expectedCustomerTotalToman =
      netSalesToman + input.shippingTotalToman + input.taxTotalToman;

    if (
      !Number.isSafeInteger(grossSalesToman) ||
      !Number.isSafeInteger(netSalesToman) ||
      netSalesToman < 0 ||
      !Number.isSafeInteger(expectedCustomerTotalToman) ||
      expectedCustomerTotalToman !== input.grandTotalToman
    ) {
      throw new BadRequestException('Order finance totals are inconsistent.');
    }

    const grossMarginBeforeServiceCostsToman = netSalesToman - supplierCostToman;

    if (!Number.isSafeInteger(grossMarginBeforeServiceCostsToman)) {
      throw new BadRequestException('Order finance margin exceeds the supported range.');
    }

    return {
      merchandiseRevenueToman: input.merchandiseTotalToman,
      platingRevenueToman: input.platingTotalToman,
      discountToman: input.discountTotalToman,
      shippingChargedToman: input.shippingTotalToman,
      taxToman: input.taxTotalToman,
      customerTotalToman: input.grandTotalToman,
      supplierCostToman,
      grossSalesToman,
      netSalesToman,
      grossMarginBeforeServiceCostsToman,
    };
  }

  private buildSnapshotWhere(from?: string, to?: string): Prisma.OrderFinanceSnapshotWhereInput {
    const paidAt = this.buildDateTimeFilter(from, to);

    return paidAt ? { paidAt } : {};
  }

  private buildDateTimeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Finance report start date must be before the end date.');
    }

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }
}
