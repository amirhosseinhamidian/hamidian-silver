import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  OrderCostEntryType,
  PaymentAttemptStatus,
  PaymentRefundStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateOrderCostDto } from './dto/create-order-cost.dto';
import { ListCostReconciliationQueryDto } from './dto/list-cost-reconciliation-query.dto';
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

  async recordActualCost(
    transaction: Prisma.TransactionClient,
    input: {
      orderId: string;
      type: OrderCostEntryType;
      amountToman: number;
      source: string;
      externalReference?: string | null;
      idempotencyKey: string;
      occurredAt: Date;
      description?: string;
    },
  ) {
    if (!Number.isSafeInteger(input.amountToman) || input.amountToman < 0 || !input.source.trim()) {
      throw new ConflictException('Provider actual cost is invalid.');
    }

    const existing = await transaction.orderCostEntry.findUnique({
      where: {
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (existing) {
      if (
        existing.orderId !== input.orderId ||
        existing.type !== input.type ||
        existing.amountToman !== input.amountToman ||
        existing.source !== input.source ||
        existing.externalReference !== (input.externalReference ?? null)
      ) {
        throw new ConflictException('Provider actual cost idempotency key is already in use.');
      }

      return existing;
    }

    await transaction.orderCostEntry.createMany({
      data: [
        {
          orderId: input.orderId,
          type: input.type,
          amountToman: input.amountToman,
          source: input.source,
          externalReference: input.externalReference,
          description: input.description,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          createdByUserId: null,
        },
      ],
      skipDuplicates: true,
    });

    const recorded = await transaction.orderCostEntry.findUniqueOrThrow({
      where: {
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (
      recorded.orderId !== input.orderId ||
      recorded.type !== input.type ||
      recorded.amountToman !== input.amountToman ||
      recorded.source !== input.source ||
      recorded.externalReference !== (input.externalReference ?? null)
    ) {
      throw new ConflictException('Provider actual cost idempotency key is already in use.');
    }

    return recorded;
  }

  async reconciliation(query: ListCostReconciliationQueryDto) {
    const paidAt = this.buildDateTimeFilter(query.from, query.to);
    const limit = query.limit ?? 50;
    const commonWhere: Prisma.OrderWhereInput = {
      financeSnapshot: {
        isNot: null,
      },
      ...(paidAt
        ? {
            paidAt,
          }
        : {}),
    };

    const [paymentOrders, shippingOrders, platingOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...commonWhere,
          payment: {
            is: {
              attempts: {
                some: {
                  status: PaymentAttemptStatus.VERIFIED,
                },
              },
            },
          },
          costEntries: {
            none: {
              type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
            },
          },
        },
        take: limit,
        orderBy: {
          paidAt: 'desc',
        },
        select: this.reconciliationSelect(),
      }),
      this.prisma.order.findMany({
        where: {
          ...commonWhere,
          shipment: {
            is: {
              providerShipmentId: {
                not: null,
              },
            },
          },
          costEntries: {
            none: {
              type: OrderCostEntryType.SHIPPING_PROVIDER,
            },
          },
        },
        take: limit,
        orderBy: {
          paidAt: 'desc',
        },
        select: this.reconciliationSelect(),
      }),
      this.prisma.order.findMany({
        where: {
          ...commonWhere,
          platingTotalToman: {
            gt: 0,
          },
          costEntries: {
            none: {
              type: OrderCostEntryType.PLATING_SERVICE,
            },
          },
        },
        take: limit,
        orderBy: {
          paidAt: 'desc',
        },
        select: this.reconciliationSelect(),
      }),
    ]);

    const byOrder = new Map<string, ReturnType<OrderCostsService['buildReconciliationRow']>>();

    for (const order of [...paymentOrders, ...shippingOrders, ...platingOrders]) {
      byOrder.set(order.id, this.buildReconciliationRow(order));
    }

    const rows = [...byOrder.values()]
      .filter((row) => row.missingCosts.length > 0)
      .sort((a, b) => {
        const aTime = a.paidAt?.getTime() ?? 0;
        const bTime = b.paidAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      count: rows.length,
      orders: rows,
    };
  }

  async orderReconciliation(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: this.reconciliationSelect(),
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    if (!order.financeSnapshot) {
      throw new ConflictException('Order finance snapshot is required for cost reconciliation.');
    }

    return this.buildReconciliationRow(order);
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

  private reconciliationSelect() {
    return {
      id: true,
      orderNumber: true,
      status: true,
      paidAt: true,
      platingTotalToman: true,
      financeSnapshot: {
        select: {
          id: true,
        },
      },
      payment: {
        select: {
          attempts: {
            where: {
              status: PaymentAttemptStatus.VERIFIED,
            },
            orderBy: {
              verifiedAt: 'desc' as const,
            },
            take: 1,
            select: {
              id: true,
              provider: true,
              providerReference: true,
              verifiedAt: true,
            },
          },
        },
      },
      shipment: {
        select: {
          id: true,
          provider: true,
          providerShipmentId: true,
          status: true,
          shippingCostToman: true,
          creationAttemptedAt: true,
        },
      },
      costEntries: {
        select: {
          id: true,
          type: true,
          amountToman: true,
          source: true,
          externalReference: true,
          occurredAt: true,
          reversalOfId: true,
        },
        orderBy: {
          occurredAt: 'asc' as const,
        },
      },
    } satisfies Prisma.OrderSelect;
  }

  private buildReconciliationRow(order: {
    id: string;
    orderNumber: string;
    status: string;
    paidAt: Date | null;
    platingTotalToman: number;
    financeSnapshot: { id: string } | null;
    payment: {
      attempts: Array<{
        id: string;
        provider: string;
        providerReference: string | null;
        verifiedAt: Date | null;
      }>;
    } | null;
    shipment: {
      id: string;
      provider: string;
      providerShipmentId: string | null;
      status: string;
      shippingCostToman: number;
      creationAttemptedAt: Date | null;
    } | null;
    costEntries: Array<{
      id: string;
      type: OrderCostEntryType;
      amountToman: number;
      source: string;
      externalReference: string | null;
      occurredAt: Date;
      reversalOfId: string | null;
    }>;
  }) {
    const costTypes = new Set(order.costEntries.map((entry) => entry.type));
    const verifiedAttempt = order.payment?.attempts[0];
    const missingCosts: Array<{
      code:
        | 'PAYMENT_GATEWAY_FEE_MISSING'
        | 'SHIPPING_PROVIDER_COST_MISSING'
        | 'PLATING_SERVICE_COST_MISSING';
      source?: string;
      externalReference?: string | null;
    }> = [];

    if (verifiedAttempt && !costTypes.has(OrderCostEntryType.PAYMENT_GATEWAY_FEE)) {
      missingCosts.push({
        code: 'PAYMENT_GATEWAY_FEE_MISSING',
        source: verifiedAttempt.provider,
        externalReference: verifiedAttempt.providerReference,
      });
    }

    if (
      order.shipment?.providerShipmentId &&
      !costTypes.has(OrderCostEntryType.SHIPPING_PROVIDER)
    ) {
      missingCosts.push({
        code: 'SHIPPING_PROVIDER_COST_MISSING',
        source: order.shipment.provider,
        externalReference: order.shipment.providerShipmentId,
      });
    }

    if (order.platingTotalToman > 0 && !costTypes.has(OrderCostEntryType.PLATING_SERVICE)) {
      missingCosts.push({
        code: 'PLATING_SERVICE_COST_MISSING',
      });
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paidAt: order.paidAt,
      financeSnapshotReady: Boolean(order.financeSnapshot),
      expected: {
        paymentGatewayFee: Boolean(verifiedAttempt),
        shippingProviderCost: Boolean(order.shipment?.providerShipmentId),
        platingServiceCost: order.platingTotalToman > 0,
      },
      evidence: {
        verifiedPaymentAttempt: verifiedAttempt ?? null,
        shipment: order.shipment,
        platingChargedToman: order.platingTotalToman,
      },
      costEntries: order.costEntries,
      missingCosts,
      reconciled: missingCosts.length === 0,
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
