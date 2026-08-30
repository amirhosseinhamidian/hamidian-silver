import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { OrderCostEntryType, PaymentRefundStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateOrderCostDto } from './dto/create-order-cost.dto';
import { ListOrderCostsQueryDto } from './dto/list-order-costs-query.dto';
import { ReverseOrderCostDto } from './dto/reverse-order-cost.dto';

@Injectable()
export class OrderCostsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListOrderCostsQueryDto) {
    const occurredAt = this.buildDateTimeFilter(query.from, query.to);

    return this.prisma.orderCostEntry.findMany({
      where: {
        orderId: query.orderId,
        type: query.type,
        source: query.source,
        occurredAt,
      },
      take: query.limit ?? 50,
      orderBy: [
        {
          occurredAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      include: this.costInclude(),
    });
  }

  async get(costId: string) {
    const cost = await this.prisma.orderCostEntry.findUnique({
      where: {
        id: costId,
      },
      include: this.costInclude(),
    });

    if (!cost) {
      throw new NotFoundException('Order cost entry was not found.');
    }

    return cost;
  }

  async create(actorUserId: string, dto: CreateOrderCostDto) {
    if (!Number.isSafeInteger(dto.amountToman) || dto.amountToman <= 0) {
      throw new BadRequestException('Order cost amount is invalid.');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const order = await transaction.order.findUnique({
          where: {
            id: dto.orderId,
          },
          select: {
            id: true,
            financeSnapshot: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException('Order was not found.');
        }

        if (!order.financeSnapshot) {
          throw new ConflictException(
            'Order finance snapshot is required before recording service costs.',
          );
        }

        const existing = await transaction.orderCostEntry.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (existing) {
          this.assertIdempotentMatch(existing, dto);
          return existing;
        }

        return transaction.orderCostEntry.create({
          data: {
            orderId: dto.orderId,
            type: dto.type,
            amountToman: dto.amountToman,
            source: dto.source,
            externalReference: dto.externalReference,
            description: dto.description,
            idempotencyKey: dto.idempotencyKey,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
            createdByUserId: actorUserId,
          },
          include: this.costInclude(),
        });
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.orderCostEntry.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
        include: this.costInclude(),
      });

      if (!existing) {
        throw error;
      }

      this.assertIdempotentMatch(existing, dto);
      return existing;
    }
  }

  async reverse(costId: string, actorUserId: string, dto: ReverseOrderCostDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const cost = await transaction.orderCostEntry.findUnique({
          where: {
            id: costId,
          },
          include: {
            reversal: true,
          },
        });

        if (!cost) {
          throw new NotFoundException('Order cost entry was not found.');
        }

        if (cost.reversalOfId) {
          throw new ConflictException('A reversal entry cannot be reversed again.');
        }

        if (cost.reversal) {
          return cost.reversal;
        }

        if (cost.amountToman <= 0) {
          throw new ConflictException('Only positive order cost entries can be reversed.');
        }

        return transaction.orderCostEntry.create({
          data: {
            orderId: cost.orderId,
            type: cost.type,
            amountToman: -cost.amountToman,
            source: cost.source,
            externalReference: cost.externalReference,
            description: dto.reason
              ? `Reversal: ${dto.reason}`.slice(0, 1000)
              : 'Order cost reversed',
            idempotencyKey: `reverse:${cost.id}`,
            occurredAt: new Date(),
            createdByUserId: actorUserId,
            reversalOfId: cost.id,
          },
          include: this.costInclude(),
        });
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const reversal = await this.prisma.orderCostEntry.findUnique({
        where: {
          reversalOfId: costId,
        },
        include: this.costInclude(),
      });

      if (!reversal) {
        throw error;
      }

      return reversal;
    }
  }

  async contribution(orderId: string) {
    const snapshot = await this.prisma.orderFinanceSnapshot.findUnique({
      where: {
        orderId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Order finance snapshot was not found.');
    }

    const [costGroups, refunds] = await Promise.all([
      this.prisma.orderCostEntry.groupBy({
        by: ['type'],
        where: {
          orderId,
        },
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
          payment: {
            orderId,
          },
        },
        _sum: {
          amountToman: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const costs = this.reduceCostGroups(costGroups);
    const confirmedRefundToman = refunds._sum.amountToman ?? 0;
    const contributionMarginToman = snapshot.grossMarginBeforeServiceCostsToman - costs.totalToman;

    return {
      order: snapshot.order,
      paidAt: snapshot.paidAt,
      grossMarginBeforeServiceCostsToman: snapshot.grossMarginBeforeServiceCostsToman,
      ...costs,
      confirmedRefundToman,
      confirmedRefundCount: refunds._count._all,
      contributionMarginToman,
      contributionAfterRefundsToman: contributionMarginToman - confirmedRefundToman,
    };
  }

  private reduceCostGroups(
    groups: Array<{
      type: OrderCostEntryType;
      _sum: {
        amountToman: number | null;
      };
      _count: {
        _all: number;
      };
    }>,
  ) {
    let paymentGatewayFeeToman = 0;
    let shippingProviderCostToman = 0;
    let platingServiceCostToman = 0;
    let manualCostAdjustmentToman = 0;
    let entryCount = 0;

    for (const group of groups) {
      const amount = group._sum.amountToman ?? 0;
      entryCount += group._count._all;

      switch (group.type) {
        case OrderCostEntryType.PAYMENT_GATEWAY_FEE:
          paymentGatewayFeeToman += amount;
          break;
        case OrderCostEntryType.SHIPPING_PROVIDER:
          shippingProviderCostToman += amount;
          break;
        case OrderCostEntryType.PLATING_SERVICE:
          platingServiceCostToman += amount;
          break;
        case OrderCostEntryType.MANUAL_ADJUSTMENT:
          manualCostAdjustmentToman += amount;
          break;
      }
    }

    const totalToman =
      paymentGatewayFeeToman +
      shippingProviderCostToman +
      platingServiceCostToman +
      manualCostAdjustmentToman;

    return {
      paymentGatewayFeeToman,
      shippingProviderCostToman,
      platingServiceCostToman,
      manualCostAdjustmentToman,
      operatingServiceCostToman: totalToman,
      costEntryCount: entryCount,
      totalToman,
    };
  }

  private costInclude() {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paidAt: true,
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
      reversalOf: {
        select: {
          id: true,
          amountToman: true,
          occurredAt: true,
        },
      },
      reversal: {
        select: {
          id: true,
          amountToman: true,
          occurredAt: true,
        },
      },
    } satisfies Prisma.OrderCostEntryInclude;
  }

  private assertIdempotentMatch(
    existing: {
      orderId: string;
      type: OrderCostEntryType;
      amountToman: number;
      source: string;
      externalReference: string | null;
    },
    dto: CreateOrderCostDto,
  ) {
    if (
      existing.orderId !== dto.orderId ||
      existing.type !== dto.type ||
      existing.amountToman !== dto.amountToman ||
      existing.source !== dto.source ||
      existing.externalReference !== (dto.externalReference ?? null)
    ) {
      throw new ConflictException('Order cost idempotency key is already in use.');
    }
  }

  private buildDateTimeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Order cost report start date must be before the end date.');
    }

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
