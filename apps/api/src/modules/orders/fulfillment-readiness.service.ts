import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListFulfillmentReadinessQueryDto } from './dto/list-fulfillment-readiness-query.dto';
import { buildFulfillmentReadiness, type FulfillmentReadinessInput } from './fulfillment-readiness';

@Injectable()
export class FulfillmentReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListFulfillmentReadinessQueryDto) {
    const where = this.listWhere(query.state);
    const orders = await this.prisma.order.findMany({
      where,
      take: query.limit ?? 50,
      orderBy: [
        {
          paidAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.readinessSelect(),
    });

    return {
      state: query.state ?? null,
      count: orders.length,
      orders: orders.map((order) => buildFulfillmentReadiness(order as FulfillmentReadinessInput)),
    };
  }

  async get(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: this.readinessSelect(),
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return buildFulfillmentReadiness(order as FulfillmentReadinessInput);
  }

  private listWhere(state?: 'READY' | 'BLOCKED'): Prisma.OrderWhereInput {
    const candidateStatus = {
      in: [OrderStatus.PAID, OrderStatus.PROCESSING],
    };
    const readyCore: Prisma.OrderWhereInput = {
      shipment: {
        is: {
          status: ShipmentStatus.PENDING,
          providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
          providerShipmentId: null,
        },
      },
      OR: [
        {
          platingTotalToman: 0,
        },
        {
          platingTotalToman: {
            gt: 0,
          },
          platingFulfillment: {
            is: {
              status: PlatingFulfillmentStatus.COMPLETED,
            },
          },
        },
      ],
    };

    if (state === 'READY') {
      return {
        status: candidateStatus,
        ...readyCore,
      };
    }

    if (state === 'BLOCKED') {
      return {
        status: candidateStatus,
        NOT: readyCore,
      };
    }

    return {
      status: candidateStatus,
    };
  }

  private readinessSelect() {
    return {
      id: true,
      orderNumber: true,
      status: true,
      paidAt: true,
      platingTotalToman: true,
      platingFulfillment: {
        select: {
          status: true,
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
        },
      },
    } satisfies Prisma.OrderSelect;
  }
}
