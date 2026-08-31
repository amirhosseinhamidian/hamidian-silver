import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  OrderCostEntryType,
  OrderStatus,
  PlatingFulfillmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from '../finance/order-costs.service';
import { CancelPlatingFulfillmentDto } from './dto/cancel-plating-fulfillment.dto';
import { CompletePlatingFulfillmentDto } from './dto/complete-plating-fulfillment.dto';
import { ListPlatingFulfillmentsQueryDto } from './dto/list-plating-fulfillments-query.dto';
import { StartPlatingFulfillmentDto } from './dto/start-plating-fulfillment.dto';

@Injectable()
export class PlatingFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderCosts: OrderCostsService,
  ) {}

  async list(query: ListPlatingFulfillmentsQueryDto) {
    const statusWhere = this.statusWhere(query.status);
    const orders = await this.prisma.order.findMany({
      where: {
        platingTotalToman: {
          gt: 0,
        },
        financeSnapshot: {
          isNot: null,
        },
        ...statusWhere,
      },
      take: query.limit ?? 50,
      orderBy: {
        paidAt: 'desc',
      },
      select: this.operationalOrderSelect(),
    });

    return orders.map((order) => this.toOperationalResult(order));
  }

  async get(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: this.operationalOrderSelect(),
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    this.assertPlatingOrder(order.platingTotalToman, Boolean(order.financeSnapshot));

    return this.toOperationalResult(order);
  }

  async start(orderId: string, actorUserId: string, dto: StartPlatingFulfillmentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          status: true,
          platingTotalToman: true,
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

      this.assertPlatingOrder(order.platingTotalToman, Boolean(order.financeSnapshot));

      if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.PROCESSING) {
        throw new ConflictException('Plating can only start for paid or processing orders.');
      }

      const now = new Date();
      const fulfillment = await transaction.orderPlatingFulfillment.upsert({
        where: {
          orderId: order.id,
        },
        update: {},
        create: {
          orderId: order.id,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
          startedByUserId: actorUserId,
          startedAt: now,
          startNote: dto.note,
        },
      });

      if (fulfillment.status === PlatingFulfillmentStatus.IN_PROGRESS) {
        return this.loadOperationalFulfillment(transaction, fulfillment.id);
      }

      if (
        fulfillment.status === PlatingFulfillmentStatus.COMPLETED ||
        fulfillment.status === PlatingFulfillmentStatus.CANCELLED
      ) {
        throw new ConflictException(
          'Completed or cancelled plating fulfillment cannot be started.',
        );
      }

      const claimed = await transaction.orderPlatingFulfillment.updateMany({
        where: {
          id: fulfillment.id,
          status: PlatingFulfillmentStatus.PENDING,
        },
        data: {
          status: PlatingFulfillmentStatus.IN_PROGRESS,
          startedByUserId: actorUserId,
          startedAt: now,
          startNote: dto.note,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Plating fulfillment state changed; reload and retry.');
      }

      return this.loadOperationalFulfillment(transaction, fulfillment.id);
    });
  }

  async complete(orderId: string, actorUserId: string, dto: CompletePlatingFulfillmentDto) {
    if (!isNonNegativeTomanInt(dto.actualCostToman)) {
      throw new BadRequestException('Actual plating cost is invalid.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const fulfillment = await transaction.orderPlatingFulfillment.findUnique({
        where: {
          orderId,
        },
        include: {
          order: {
            select: {
              id: true,
              platingTotalToman: true,
              financeSnapshot: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!fulfillment) {
        throw new NotFoundException('Plating fulfillment must be started before completion.');
      }

      this.assertPlatingOrder(
        fulfillment.order.platingTotalToman,
        Boolean(fulfillment.order.financeSnapshot),
      );

      if (fulfillment.status === PlatingFulfillmentStatus.COMPLETED) {
        if (
          fulfillment.actualCostToman === dto.actualCostToman &&
          fulfillment.externalReference === (dto.externalReference ?? null)
        ) {
          return this.loadFinancialFulfillment(transaction, fulfillment.id);
        }

        throw new ConflictException(
          'Plating fulfillment is already completed with different financial data.',
        );
      }

      if (fulfillment.status !== PlatingFulfillmentStatus.IN_PROGRESS) {
        throw new ConflictException('Only in-progress plating fulfillment can be completed.');
      }

      const completedAt = new Date();
      const claimed = await transaction.orderPlatingFulfillment.updateMany({
        where: {
          id: fulfillment.id,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
        },
        data: {
          status: PlatingFulfillmentStatus.COMPLETED,
          actualCostToman: dto.actualCostToman,
          externalReference: dto.externalReference,
          completionNote: dto.note,
          completedByUserId: actorUserId,
          completedAt,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Plating fulfillment state changed; reload and retry.');
      }

      await this.orderCosts.recordActualCost(transaction, {
        orderId: fulfillment.orderId,
        type: OrderCostEntryType.PLATING_SERVICE,
        amountToman: dto.actualCostToman,
        source: 'plating-fulfillment',
        externalReference: dto.externalReference ?? fulfillment.id,
        idempotencyKey: `plating-fulfillment:${fulfillment.id}:actual-cost`,
        occurredAt: completedAt,
        description: dto.note ?? 'Actual plating fulfillment cost',
        createdByUserId: actorUserId,
      });

      return this.loadFinancialFulfillment(transaction, fulfillment.id);
    });
  }

  async cancel(orderId: string, actorUserId: string, dto: CancelPlatingFulfillmentDto) {
    return this.prisma.$transaction(async (transaction) => {
      const fulfillment = await transaction.orderPlatingFulfillment.findUnique({
        where: {
          orderId,
        },
      });

      if (!fulfillment) {
        throw new NotFoundException('Plating fulfillment was not found.');
      }

      if (fulfillment.status === PlatingFulfillmentStatus.CANCELLED) {
        return this.loadOperationalFulfillment(transaction, fulfillment.id);
      }

      if (fulfillment.status === PlatingFulfillmentStatus.COMPLETED) {
        throw new ConflictException(
          'Completed plating fulfillment cannot be cancelled; use a financial reversal if needed.',
        );
      }

      const claimed = await transaction.orderPlatingFulfillment.updateMany({
        where: {
          id: fulfillment.id,
          status: {
            in: [PlatingFulfillmentStatus.PENDING, PlatingFulfillmentStatus.IN_PROGRESS],
          },
        },
        data: {
          status: PlatingFulfillmentStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledByUserId: actorUserId,
          cancelledAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Plating fulfillment state changed; reload and retry.');
      }

      return this.loadOperationalFulfillment(transaction, fulfillment.id);
    });
  }

  private statusWhere(status?: PlatingFulfillmentStatus): Prisma.OrderWhereInput {
    if (!status) {
      return {};
    }

    if (status === PlatingFulfillmentStatus.PENDING) {
      return {
        OR: [
          {
            platingFulfillment: {
              is: null,
            },
          },
          {
            platingFulfillment: {
              is: {
                status: PlatingFulfillmentStatus.PENDING,
              },
            },
          },
        ],
      };
    }

    return {
      platingFulfillment: {
        is: {
          status,
        },
      },
    };
  }

  private assertPlatingOrder(platingTotalToman: number, financeSnapshotReady: boolean) {
    if (platingTotalToman <= 0) {
      throw new BadRequestException('Order does not contain a paid plating service.');
    }

    if (!financeSnapshotReady) {
      throw new ConflictException('Order finance snapshot is required before plating fulfillment.');
    }
  }

  private operationalOrderSelect() {
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
      items: {
        where: {
          platingType: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'asc' as const,
        },
        select: {
          id: true,
          productNameSnapshot: true,
          variantNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          platingType: true,
          platingWeightGrams: true,
          platingLeadTimeDays: true,
        },
      },
      platingFulfillment: {
        select: this.operationalFulfillmentSelect(),
      },
    } satisfies Prisma.OrderSelect;
  }

  private operationalFulfillmentSelect() {
    return {
      id: true,
      orderId: true,
      status: true,
      startNote: true,
      completionNote: true,
      cancellationReason: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      startedBy: {
        select: this.actorSelect(),
      },
      completedBy: {
        select: this.actorSelect(),
      },
      cancelledBy: {
        select: this.actorSelect(),
      },
    } satisfies Prisma.OrderPlatingFulfillmentSelect;
  }

  private financialFulfillmentInclude() {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paidAt: true,
          platingTotalToman: true,
        },
      },
      startedBy: {
        select: this.actorSelect(),
      },
      completedBy: {
        select: this.actorSelect(),
      },
      cancelledBy: {
        select: this.actorSelect(),
      },
    } satisfies Prisma.OrderPlatingFulfillmentInclude;
  }

  private actorSelect() {
    return {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    };
  }

  private toOperationalResult(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paidAt: Date | null;
    platingTotalToman: number;
    financeSnapshot: { id: string } | null;
    items: unknown[];
    platingFulfillment: {
      id: string;
      orderId: string;
      status: PlatingFulfillmentStatus;
      startNote: string | null;
      completionNote: string | null;
      cancellationReason: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      startedBy: unknown;
      completedBy: unknown;
      cancelledBy: unknown;
    } | null;
  }) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paidAt: order.paidAt,
      items: order.items,
      fulfillmentStatus: order.platingFulfillment?.status ?? PlatingFulfillmentStatus.PENDING,
      fulfillment: order.platingFulfillment,
    };
  }

  private loadOperationalFulfillment(transaction: Prisma.TransactionClient, fulfillmentId: string) {
    return transaction.orderPlatingFulfillment.findUniqueOrThrow({
      where: {
        id: fulfillmentId,
      },
      select: this.operationalFulfillmentSelect(),
    });
  }

  private loadFinancialFulfillment(transaction: Prisma.TransactionClient, fulfillmentId: string) {
    return transaction.orderPlatingFulfillment.findUniqueOrThrow({
      where: {
        id: fulfillmentId,
      },
      include: this.financialFulfillmentInclude(),
    });
  }
}
