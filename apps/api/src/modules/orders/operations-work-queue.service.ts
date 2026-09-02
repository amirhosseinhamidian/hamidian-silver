import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OperationsWorkQueueQueryDto } from './dto/operations-work-queue-query.dto';
import {
  buildOperationsWorkItems,
  sortOperationsWorkItems,
  summarizeOperationsWorkItems,
  type OperationsWorkQueueInput,
} from './operations-work-queue';

@Injectable()
export class OperationsWorkQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: OperationsWorkQueueQueryDto) {
    const now = new Date();
    const allItems = await this.snapshot(now);
    const filtered = allItems.filter(
      (item) =>
        (!query.type || item.workType === query.type) &&
        (!query.state || item.state === query.state),
    );
    const limit = query.limit ?? 50;

    return {
      generatedAt: now,
      type: query.type ?? null,
      state: query.state ?? null,
      totalMatched: filtered.length,
      count: Math.min(filtered.length, limit),
      items: filtered.slice(0, limit),
    };
  }

  async summary() {
    const now = new Date();
    const items = await this.snapshot(now);

    return {
      generatedAt: now,
      ...summarizeOperationsWorkItems(items),
    };
  }

  async snapshot(now = new Date()) {
    const orders = await this.loadOperationalOrders();

    return sortOperationsWorkItems(
      orders.flatMap((order) => buildOperationsWorkItems(order as OperationsWorkQueueInput, now)),
    );
  }

  private loadOperationalOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.PROCESSING],
        },
        payment: {
          is: {
            status: PaymentStatus.PAID,
          },
        },
      },
      orderBy: [
        {
          paidAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
      select: this.workQueueSelect(),
    });
  }

  private workQueueSelect() {
    return {
      id: true,
      orderNumber: true,
      status: true,
      paidAt: true,
      platingTotalToman: true,
      payment: {
        select: {
          status: true,
        },
      },
      items: {
        where: {
          platingType: {
            not: null,
          },
        },
        select: {
          platingLeadTimeDays: true,
        },
      },
      platingFulfillment: {
        select: {
          status: true,
          startedAt: true,
          cancelledAt: true,
        },
      },
      shipment: {
        select: {
          id: true,
          status: true,
          provider: true,
          providerCreationState: true,
          providerShipmentId: true,
          providerCreateError: true,
          creationAttemptedAt: true,
          updatedAt: true,
        },
      },
    } satisfies Prisma.OrderSelect;
  }
}
