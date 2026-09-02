import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isNonNegativeInt32 } from '../../common/int32';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  InventoryMovementType,
  OrderReturnDisposition,
  OrderReturnStatus,
  OrderStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CancelOrderReturnDto } from './dto/cancel-order-return.dto';
import { CreateOrderReturnDto } from './dto/create-order-return.dto';
import { ReceiveOrderReturnDto } from './dto/receive-order-return.dto';

@Injectable()
export class OrderReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  listForOrder(orderId: string) {
    return this.prisma.orderReturn.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: this.returnInclude(),
    });
  }

  async get(returnId: string) {
    const orderReturn = await this.prisma.orderReturn.findUnique({
      where: {
        id: returnId,
      },
      include: this.returnInclude(),
    });

    if (!orderReturn) {
      throw new NotFoundException('Order return was not found.');
    }

    return orderReturn;
  }

  async create(orderId: string, actorUserId: string, dto: CreateOrderReturnDto) {
    this.assertUniqueIds(
      dto.items.map(({ orderItemId }) => orderItemId),
      'Duplicate order items are not allowed in one return.',
    );

    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order was not found.');
      }

      if (order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.DELIVERED) {
        throw new ConflictException('Returns can only be created for shipped or delivered orders.');
      }

      const orderItems = new Map(order.items.map((item) => [item.id, item]));

      for (const requested of dto.items) {
        const orderItem = orderItems.get(requested.orderItemId);

        if (!orderItem) {
          throw new BadRequestException('One or more return items do not belong to the order.');
        }

        if (requested.quantity > orderItem.quantity) {
          throw new BadRequestException('Return quantity exceeds the sold order item quantity.');
        }

        const claimed = await transaction.orderItem.updateMany({
          where: {
            id: orderItem.id,
            orderId: order.id,
            returnAllocatedQuantity: {
              lte: orderItem.quantity - requested.quantity,
            },
          },
          data: {
            returnAllocatedQuantity: {
              increment: requested.quantity,
            },
          },
        });

        if (claimed.count !== 1) {
          throw new ConflictException('Return quantity capacity changed; reload and retry.');
        }
      }

      return transaction.orderReturn.create({
        data: {
          orderId: order.id,
          requestedByUserId: actorUserId,
          reason: dto.reason,
          items: {
            create: dto.items.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.quantity,
            })),
          },
        },
        include: this.returnInclude(),
      });
    });
  }

  async receive(returnId: string, actorUserId: string, dto: ReceiveOrderReturnDto) {
    this.assertUniqueIds(
      dto.items.map(({ returnItemId }) => returnItemId),
      'Duplicate return items are not allowed.',
    );

    return this.prisma.$transaction(async (transaction) => {
      const orderReturn = await transaction.orderReturn.findUnique({
        where: {
          id: returnId,
        },
        include: {
          order: true,
          items: {
            include: {
              orderItem: true,
            },
          },
        },
      });

      if (!orderReturn) {
        throw new NotFoundException('Order return was not found.');
      }

      if (orderReturn.status === OrderReturnStatus.RECEIVED) {
        return transaction.orderReturn.findUniqueOrThrow({
          where: {
            id: orderReturn.id,
          },
          include: this.returnInclude(),
        });
      }

      if (orderReturn.status !== OrderReturnStatus.REQUESTED) {
        throw new ConflictException('Only requested returns can be received.');
      }

      if (dto.items.length !== orderReturn.items.length) {
        throw new BadRequestException(
          'Receive disposition must be supplied for every return item.',
        );
      }

      const dispositionByItem = new Map(
        dto.items.map((item) => [item.returnItemId, item.disposition]),
      );

      if (orderReturn.items.some((item) => !dispositionByItem.has(item.id))) {
        throw new BadRequestException(
          'Receive disposition contains an unknown or missing return item.',
        );
      }

      const receivedAt = new Date();
      const claimed = await transaction.orderReturn.updateMany({
        where: {
          id: orderReturn.id,
          status: OrderReturnStatus.REQUESTED,
        },
        data: {
          status: OrderReturnStatus.RECEIVED,
          receivedByUserId: actorUserId,
          receivedAt,
          receiveNote: dto.note,
        },
      });

      if (claimed.count !== 1) {
        const current = await transaction.orderReturn.findUnique({
          where: {
            id: orderReturn.id,
          },
          select: {
            status: true,
          },
        });

        if (current?.status === OrderReturnStatus.RECEIVED) {
          return transaction.orderReturn.findUniqueOrThrow({
            where: {
              id: orderReturn.id,
            },
            include: this.returnInclude(),
          });
        }

        throw new ConflictException('Order return state changed; reload and retry.');
      }

      for (const item of orderReturn.items) {
        const disposition = dispositionByItem.get(item.id);

        if (!disposition) {
          throw new BadRequestException('Receive disposition is required for every return item.');
        }

        const returned = await transaction.orderItem.updateMany({
          where: {
            id: item.orderItem.id,
            returnedQuantity: {
              lte: item.orderItem.quantity - item.quantity,
            },
            returnAllocatedQuantity: {
              gte: item.orderItem.returnedQuantity + item.quantity,
            },
          },
          data: {
            returnedQuantity: {
              increment: item.quantity,
            },
          },
        });

        if (returned.count !== 1) {
          throw new ConflictException('Returned quantity changed; reload and retry.');
        }

        await transaction.orderReturnItem.update({
          where: {
            id: item.id,
          },
          data: {
            disposition,
          },
        });

        if (disposition === OrderReturnDisposition.RESTOCK) {
          await this.restockItem(
            transaction,
            orderReturn.order.warehouseId,
            item.id,
            item.orderItem.variantId,
            item.quantity,
            actorUserId,
          );
          continue;
        }

        await this.createSupplierCredit(
          transaction,
          orderReturn.order.id,
          item.id,
          item.orderItem,
          item.quantity,
          actorUserId,
        );
      }

      return transaction.orderReturn.findUniqueOrThrow({
        where: {
          id: orderReturn.id,
        },
        include: this.returnInclude(),
      });
    });
  }

  async cancel(returnId: string, actorUserId: string, dto: CancelOrderReturnDto) {
    return this.prisma.$transaction(async (transaction) => {
      const orderReturn = await transaction.orderReturn.findUnique({
        where: {
          id: returnId,
        },
        include: {
          items: true,
        },
      });

      if (!orderReturn) {
        throw new NotFoundException('Order return was not found.');
      }

      if (orderReturn.status === OrderReturnStatus.CANCELLED) {
        return transaction.orderReturn.findUniqueOrThrow({
          where: {
            id: orderReturn.id,
          },
          include: this.returnInclude(),
        });
      }

      if (orderReturn.status !== OrderReturnStatus.REQUESTED) {
        throw new ConflictException('Only requested returns can be cancelled.');
      }

      const claimed = await transaction.orderReturn.updateMany({
        where: {
          id: orderReturn.id,
          status: OrderReturnStatus.REQUESTED,
        },
        data: {
          status: OrderReturnStatus.CANCELLED,
          cancelledByUserId: actorUserId,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
      });

      if (claimed.count !== 1) {
        const current = await transaction.orderReturn.findUnique({
          where: {
            id: orderReturn.id,
          },
          select: {
            status: true,
          },
        });

        if (current?.status === OrderReturnStatus.CANCELLED) {
          return transaction.orderReturn.findUniqueOrThrow({
            where: {
              id: orderReturn.id,
            },
            include: this.returnInclude(),
          });
        }

        throw new ConflictException('Order return state changed; reload and retry.');
      }

      for (const item of orderReturn.items) {
        const released = await transaction.orderItem.updateMany({
          where: {
            id: item.orderItemId,
            returnAllocatedQuantity: {
              gte: item.quantity,
            },
          },
          data: {
            returnAllocatedQuantity: {
              decrement: item.quantity,
            },
          },
        });

        if (released.count !== 1) {
          throw new ConflictException('Return quantity allocation is inconsistent.');
        }
      }

      return transaction.orderReturn.findUniqueOrThrow({
        where: {
          id: orderReturn.id,
        },
        include: this.returnInclude(),
      });
    });
  }

  private async restockItem(
    transaction: Prisma.TransactionClient,
    warehouseId: string,
    returnItemId: string,
    variantId: string,
    quantity: number,
    actorUserId: string,
  ) {
    const inventory = await transaction.inventory.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId,
          variantId,
        },
      },
    });

    if (!inventory) {
      throw new ConflictException('Inventory record is missing for the returned item.');
    }

    const nextOnHand = inventory.onHand + quantity;

    if (!isNonNegativeInt32(nextOnHand)) {
      throw new BadRequestException('Returned inventory exceeds the supported range.');
    }

    const updated = await transaction.inventory.updateMany({
      where: {
        id: inventory.id,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
      },
      data: {
        onHand: nextOnHand,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Inventory changed while receiving the return; retry.');
    }

    await transaction.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        actorUserId,
        type: InventoryMovementType.RETURN,
        onHandDelta: quantity,
        reservedDelta: 0,
        onHandAfter: nextOnHand,
        reservedAfter: inventory.reserved,
        reason: 'Customer return restocked',
        referenceType: 'ORDER_RETURN_ITEM',
        referenceId: returnItemId,
      },
    });
  }

  private async createSupplierCredit(
    transaction: Prisma.TransactionClient,
    orderId: string,
    returnItemId: string,
    orderItem: {
      id: string;
      supplierIdSnapshot: string | null;
      supplierNameSnapshot: string | null;
      unitSupplierPriceToman: number | null;
    },
    quantity: number,
    actorUserId: string,
  ) {
    if (
      !orderItem.supplierIdSnapshot ||
      !orderItem.supplierNameSnapshot ||
      orderItem.unitSupplierPriceToman === null
    ) {
      throw new ConflictException(
        'Supplier snapshot is required to return an item to the supplier.',
      );
    }

    const amountToman = orderItem.unitSupplierPriceToman * quantity;

    if (!isNonNegativeTomanInt(amountToman)) {
      throw new BadRequestException('Supplier credit amount exceeds the supported range.');
    }

    const expectedCredit = {
      orderId,
      orderItemId: orderItem.id,
      returnItemId,
      supplierIdSnapshot: orderItem.supplierIdSnapshot,
      supplierNameSnapshot: orderItem.supplierNameSnapshot,
      quantity,
      unitSupplierPriceToman: orderItem.unitSupplierPriceToman,
      amountToman,
    };

    const created = await transaction.supplierCredit.createMany({
      data: [
        {
          ...expectedCredit,
          createdByUserId: actorUserId,
        },
      ],
      skipDuplicates: true,
    });

    if (created.count === 1) {
      return;
    }

    const existing = await transaction.supplierCredit.findUnique({
      where: {
        returnItemId,
      },
    });

    if (
      !existing ||
      existing.orderId !== expectedCredit.orderId ||
      existing.orderItemId !== expectedCredit.orderItemId ||
      existing.returnItemId !== expectedCredit.returnItemId ||
      existing.supplierIdSnapshot !== expectedCredit.supplierIdSnapshot ||
      existing.supplierNameSnapshot !== expectedCredit.supplierNameSnapshot ||
      existing.quantity !== expectedCredit.quantity ||
      existing.unitSupplierPriceToman !== expectedCredit.unitSupplierPriceToman ||
      existing.amountToman !== expectedCredit.amountToman
    ) {
      throw new ConflictException(
        'Existing supplier credit does not match the received return item.',
      );
    }
  }

  private returnInclude() {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          warehouseId: true,
        },
      },
      items: {
        orderBy: {
          createdAt: 'asc' as const,
        },
        include: {
          orderItem: {
            select: {
              id: true,
              productNameSnapshot: true,
              variantNameSnapshot: true,
              skuSnapshot: true,
              quantity: true,
              returnAllocatedQuantity: true,
              returnedQuantity: true,
              supplierIdSnapshot: true,
              supplierNameSnapshot: true,
              unitSupplierPriceToman: true,
            },
          },
          supplierCredit: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
      receivedBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
      cancelledBy: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    };
  }

  private assertUniqueIds(ids: string[], message: string) {
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(message);
    }
  }
}
