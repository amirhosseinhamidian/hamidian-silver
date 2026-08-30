import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { InventoryMovementType, OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

export type ExpireDueOrdersResult = {
  scanned: number;
  expired: number;
  skipped: number;
};

@Injectable()
export class OrderExpirationService {
  constructor(private readonly prisma: PrismaService) {}

  async expireDueOrders(
    now = new Date(),
    limit = DEFAULT_BATCH_SIZE,
  ): Promise<ExpireDueOrdersResult> {
    const take = Math.min(Math.max(Math.trunc(limit), 1), MAX_BATCH_SIZE);
    const dueOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        reservationExpiresAt: {
          lte: now,
        },
      },
      orderBy: {
        reservationExpiresAt: 'asc',
      },
      take,
      select: {
        id: true,
      },
    });

    let expired = 0;
    let skipped = 0;

    for (const order of dueOrders) {
      if (await this.expireOrder(order.id, now)) {
        expired += 1;
      } else {
        skipped += 1;
      }
    }

    return {
      scanned: dueOrders.length,
      expired,
      skipped,
    };
  }

  async expireOrder(orderId: string, now = new Date()): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          warehouseId: true,
          status: true,
          reservationExpiresAt: true,
          payment: {
            select: {
              status: true,
            },
          },
          items: {
            select: {
              variantId: true,
              quantity: true,
            },
          },
        },
      });

      if (
        !order ||
        order.status !== OrderStatus.PENDING_PAYMENT ||
        order.reservationExpiresAt > now
      ) {
        return false;
      }

      if (
        order.payment?.status === PaymentStatus.PAID ||
        order.payment?.status === PaymentStatus.RECONCILIATION_REQUIRED
      ) {
        return false;
      }

      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: {
            lte: now,
          },
        },
        data: {
          status: OrderStatus.EXPIRED,
        },
      });

      if (claimed.count !== 1) {
        return false;
      }

      await this.releaseReservedInventory(transaction, order.warehouseId, order.id, order.items);

      await transaction.payment.updateMany({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
        },
      });

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId: null,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.EXPIRED,
          reason: 'Inventory reservation expired',
        },
      });

      return true;
    });
  }

  private async releaseReservedInventory(
    transaction: Prisma.TransactionClient,
    warehouseId: string,
    orderId: string,
    items: Array<{ variantId: string; quantity: number }>,
  ): Promise<void> {
    const quantitiesByVariant = new Map<string, number>();

    for (const item of items) {
      quantitiesByVariant.set(
        item.variantId,
        (quantitiesByVariant.get(item.variantId) ?? 0) + item.quantity,
      );
    }

    for (const [variantId, quantity] of quantitiesByVariant) {
      const inventory = await transaction.inventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId,
            variantId,
          },
        },
      });

      if (!inventory || inventory.reserved < quantity) {
        throw new ConflictException('Reserved inventory is inconsistent while expiring the order.');
      }

      const nextReserved = inventory.reserved - quantity;
      const updated = await transaction.inventory.updateMany({
        where: {
          id: inventory.id,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
        },
        data: {
          reserved: nextReserved,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Inventory changed while expiring the order; retry is required.',
        );
      }

      await transaction.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          actorUserId: null,
          type: InventoryMovementType.RELEASE,
          onHandDelta: 0,
          reservedDelta: -quantity,
          onHandAfter: inventory.onHand,
          reservedAfter: nextReserved,
          reason: 'Order inventory reservation expired',
          referenceType: 'ORDER',
          referenceId: orderId,
        },
      });
    }
  }
}
