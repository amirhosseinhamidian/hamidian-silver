import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isNonNegativeTomanInt, TOMAN_INT_MAX } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  OrderStatus,
  PaymentStatus,
  PlatingType,
  ProductStatus,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { normalizeIranianMobile } from '../auth/phone-normalizer';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderAddressDto, CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const RESERVATION_TTL_MINUTES = 15;

const CUSTOMER_ORDER_ITEM_SELECT = {
  id: true,
  variantId: true,
  quantity: true,
  productNameSnapshot: true,
  variantNameSnapshot: true,
  skuSnapshot: true,
  sizeLabelSnapshot: true,
  unitSalePriceToman: true,
  platingType: true,
  platingWeightGrams: true,
  platingRateToman: true,
  unitPlatingPriceToman: true,
  platingLeadTimeDays: true,
  unitWeightGrams: true,
  lineTotalToman: true,
  createdAt: true,
} satisfies Prisma.OrderItemSelect;

const CUSTOMER_ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  merchandiseTotalToman: true,
  platingTotalToman: true,
  discountTotalToman: true,
  shippingTotalToman: true,
  taxTotalToman: true,
  grandTotalToman: true,
  reservationExpiresAt: true,
  paidAt: true,
  cancelledAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: CUSTOMER_ORDER_ITEM_SELECT,
  },
} satisfies Prisma.OrderSelect;

const CUSTOMER_ORDER_DETAIL_SELECT = {
  ...CUSTOMER_ORDER_LIST_SELECT,
  shippingAddress: {
    select: {
      recipientName: true,
      phone: true,
      province: true,
      city: true,
      addressLine: true,
      postalCode: true,
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

type PreparedOrderItem = {
  variantId: string;
  quantity: number;
  productNameSnapshot: string;
  variantNameSnapshot?: string;
  skuSnapshot: string;
  sizeLabelSnapshot?: string;
  unitSalePriceToman: number;
  unitSupplierPriceToman?: number;
  supplierIdSnapshot?: string;
  supplierNameSnapshot?: string;
  platingType?: PlatingType;
  platingWeightGrams?: string;
  platingRateToman?: number;
  unitPlatingPriceToman: number;
  platingLeadTimeDays?: number;
  unitWeightGrams?: string;
  lineTotalToman: number;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    this.assertUniqueItemSelections(dto.items);

    return this.prisma.$transaction(async (transaction) => {
      const shippingAddress = await this.resolveShippingAddress(transaction, userId, dto);

      const warehouse = await transaction.warehouse.findFirst({
        where: {
          isDefault: true,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!warehouse) {
        throw new BadRequestException('No active default warehouse is configured.');
      }

      const variantIds = [...new Set(dto.items.map(({ variantId }) => variantId))];
      const variants = await transaction.productVariant.findMany({
        where: {
          id: {
            in: variantIds,
          },
          isActive: true,
          deletedAt: null,
          product: {
            status: ProductStatus.ACTIVE,
            deletedAt: null,
          },
        },
        include: {
          size: true,
          product: {
            include: {
              suppliers: {
                where: {
                  isActive: true,
                  supplier: {
                    isActive: true,
                    deletedAt: null,
                  },
                },
                orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
                take: 1,
                include: {
                  supplier: true,
                },
              },
            },
          },
          platingOptions: {
            where: {
              isActive: true,
              platingRate: {
                isActive: true,
              },
            },
            include: {
              platingRate: true,
            },
          },
        },
      });

      if (variants.length !== variantIds.length) {
        throw new NotFoundException('One or more product variants were not found.');
      }

      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      const preparedItems = dto.items.map((item) => {
        const variant = variantById.get(item.variantId);

        if (!variant) {
          throw new NotFoundException('Product variant was not found.');
        }

        return this.prepareOrderItem(item, variant);
      });

      const merchandiseTotalToman = preparedItems.reduce(
        (total, item) => total + item.unitSalePriceToman * item.quantity,
        0,
      );
      const platingTotalToman = preparedItems.reduce(
        (total, item) => total + item.unitPlatingPriceToman * item.quantity,
        0,
      );
      const grandTotalToman = merchandiseTotalToman + platingTotalToman;

      this.assertSafeTomanAmount(merchandiseTotalToman);
      this.assertSafeTomanAmount(platingTotalToman);
      this.assertSafeTomanAmount(grandTotalToman);

      const orderId = randomUUID();
      const orderNumber = `HS-${orderId.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
      const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

      const order = await transaction.order.create({
        data: {
          id: orderId,
          orderNumber,
          userId,
          warehouseId: warehouse.id,
          status: OrderStatus.PENDING_PAYMENT,
          merchandiseTotalToman,
          platingTotalToman,
          grandTotalToman,
          reservationExpiresAt,
          shippingAddress: {
            create: shippingAddress,
          },
          items: {
            create: preparedItems.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              productNameSnapshot: item.productNameSnapshot,
              variantNameSnapshot: item.variantNameSnapshot,
              skuSnapshot: item.skuSnapshot,
              sizeLabelSnapshot: item.sizeLabelSnapshot,
              unitSalePriceToman: item.unitSalePriceToman,
              unitSupplierPriceToman: item.unitSupplierPriceToman,
              supplierIdSnapshot: item.supplierIdSnapshot,
              supplierNameSnapshot: item.supplierNameSnapshot,
              platingType: item.platingType,
              platingWeightGrams: item.platingWeightGrams,
              platingRateToman: item.platingRateToman,
              unitPlatingPriceToman: item.unitPlatingPriceToman,
              platingLeadTimeDays: item.platingLeadTimeDays,
              unitWeightGrams: item.unitWeightGrams,
              lineTotalToman: item.lineTotalToman,
            })),
          },
        },
        select: {
          id: true,
        },
      });

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId: userId,
          fromStatus: null,
          toStatus: OrderStatus.PENDING_PAYMENT,
          reason: 'Order created',
        },
      });

      await this.reserveInventory(transaction, warehouse.id, order.id, preparedItems, userId);

      return transaction.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
        select: CUSTOMER_ORDER_DETAIL_SELECT,
      });
    });
  }

  listMyOrders(userId: string, query: ListOrdersQueryDto) {
    return this.prisma.order.findMany({
      where: {
        userId,
        status: query.status,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      select: CUSTOMER_ORDER_LIST_SELECT,
    });
  }

  async getMyOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: CUSTOMER_ORDER_DETAIL_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  listOrders(query: ListOrdersQueryDto) {
    return this.prisma.order.findMany({
      where: {
        status: query.status,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
      },
    });
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          payment: {
            select: {
              status: true,
            },
          },
          shipment: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order was not found.');
      }

      if (order.status === dto.status) {
        return order;
      }

      const allowedNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
        [OrderStatus.PAID]: OrderStatus.PROCESSING,
        [OrderStatus.PROCESSING]: OrderStatus.SHIPPED,
        [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
      };

      if (allowedNextStatus[order.status] !== dto.status) {
        throw new BadRequestException('This order status transition is not allowed.');
      }

      if (
        order.status === OrderStatus.PAID &&
        dto.status === OrderStatus.PROCESSING &&
        order.payment?.status !== PaymentStatus.PAID
      ) {
        throw new ConflictException(
          'Order cannot enter processing while its payment is not fully settled.',
        );
      }

      if (dto.status === OrderStatus.SHIPPED) {
        if (
          !order.shipment ||
          !new Set<ShipmentStatus>([
            ShipmentStatus.HANDED_OVER,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.DELIVERED,
          ]).has(order.shipment.status)
        ) {
          throw new ConflictException(
            'Order cannot be marked as shipped before the shipment is handed over.',
          );
        }
      }

      if (
        dto.status === OrderStatus.DELIVERED &&
        order.shipment?.status !== ShipmentStatus.DELIVERED
      ) {
        throw new ConflictException(
          'Order cannot be marked as delivered before the shipment is delivered.',
        );
      }

      const deliveredAt = dto.status === OrderStatus.DELIVERED ? new Date() : order.deliveredAt;
      const claimed = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          ...(dto.status === OrderStatus.PROCESSING
            ? {
                payment: {
                  is: {
                    status: PaymentStatus.PAID,
                  },
                },
              }
            : {}),
        },
        data: {
          status: dto.status,
          deliveredAt,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Order state changed; reload and retry the status update.');
      }

      const updated = await transaction.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
      });

      await transaction.orderStatusHistory.create({
        data: {
          orderId,
          actorUserId,
          fromStatus: order.status,
          toStatus: dto.status,
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  async cancelOrder(orderId: string, dto: CancelOrderDto, actorUserId: string) {
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

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException(
          'At this stage only pending-payment orders can be cancelled.',
        );
      }

      const cancelledAt = new Date();
      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('Order state changed while cancelling; reload and retry.');
      }

      const quantitiesByVariant = new Map<string, number>();

      for (const item of order.items) {
        quantitiesByVariant.set(
          item.variantId,
          (quantitiesByVariant.get(item.variantId) ?? 0) + item.quantity,
        );
      }

      for (const [variantId, quantity] of quantitiesByVariant) {
        const inventory = await transaction.inventory.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: order.warehouseId,
              variantId,
            },
          },
        });

        if (!inventory || inventory.reserved < quantity) {
          throw new ConflictException('Reserved inventory is inconsistent.');
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
          throw new ConflictException('Inventory changed; please retry.');
        }

        await transaction.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            actorUserId,
            type: 'RELEASE',
            onHandDelta: 0,
            reservedDelta: -quantity,
            onHandAfter: inventory.onHand,
            reservedAfter: nextReserved,
            reason: dto.reason ?? 'Order cancelled',
            referenceType: 'ORDER',
            referenceId: order.id,
          },
        });
      }

      const cancelled = await transaction.order.findUniqueOrThrow({
        where: {
          id: order.id,
        },
      });

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          reason: dto.reason,
        },
      });

      return cancelled;
    });
  }

  private async resolveShippingAddress(
    transaction: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderAddressDto> {
    const hasSavedAddress = dto.userAddressId !== undefined;
    const hasInlineAddress = dto.shippingAddress !== undefined;

    if (hasSavedAddress === hasInlineAddress) {
      throw new BadRequestException('Provide exactly one of userAddressId or shippingAddress.');
    }

    if (dto.userAddressId) {
      const address = await transaction.userAddress.findFirst({
        where: {
          id: dto.userAddressId,
          userId,
          deletedAt: null,
        },
        select: {
          recipientName: true,
          phone: true,
          province: true,
          city: true,
          addressLine: true,
          postalCode: true,
        },
      });

      if (!address) {
        throw new NotFoundException('Saved address was not found.');
      }

      return address;
    }

    const address = dto.shippingAddress;

    if (!address) {
      throw new BadRequestException('Shipping address is required.');
    }

    return {
      recipientName: address.recipientName,
      phone: normalizeIranianMobile(address.phone),
      province: address.province,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
    };
  }

  private prepareOrderItem(
    item: CreateOrderItemDto,
    variant: {
      id: string;
      sku: string;
      name: string | null;
      weightGrams: { toString(): string } | null;
      platingEligible: boolean;
      size: { label: string } | null;
      product: {
        name: string;
        salePriceToman: number | null;
        suppliers: Array<{
          supplierId: string;
          supplierPriceToman: number;
          supplier: { name: string };
        }>;
      };
      platingOptions: Array<{
        platingRate: {
          type: PlatingType;
          pricePerGramToman: number;
          leadTimeDays: number;
        };
      }>;
    },
  ): PreparedOrderItem {
    if (variant.product.salePriceToman === null) {
      throw new BadRequestException('Product sale price is not configured.');
    }

    const supplier = variant.product.suppliers[0];
    let unitPlatingPriceToman = 0;
    let platingWeightGrams: string | undefined;
    let platingRateToman: number | undefined;
    let platingLeadTimeDays: number | undefined;

    if (item.platingType) {
      if (!variant.platingEligible) {
        throw new BadRequestException('Plating is not available for this variant.');
      }

      if (!variant.weightGrams) {
        throw new BadRequestException('Variant weight is required for plating.');
      }

      const option = variant.platingOptions.find(
        ({ platingRate }) => platingRate.type === item.platingType,
      );

      if (!option) {
        throw new BadRequestException(
          'The selected plating type is not available for this variant.',
        );
      }

      platingWeightGrams = variant.weightGrams.toString();
      platingRateToman = option.platingRate.pricePerGramToman;
      platingLeadTimeDays = option.platingRate.leadTimeDays;
      unitPlatingPriceToman = this.calculatePlatingPrice(platingWeightGrams, platingRateToman);
    }

    const unitSalePriceToman = variant.product.salePriceToman;
    const lineTotalToman = (unitSalePriceToman + unitPlatingPriceToman) * item.quantity;

    this.assertSafeTomanAmount(lineTotalToman);

    return {
      variantId: variant.id,
      quantity: item.quantity,
      productNameSnapshot: variant.product.name,
      variantNameSnapshot: variant.name ?? undefined,
      skuSnapshot: variant.sku,
      sizeLabelSnapshot: variant.size?.label,
      unitSalePriceToman,
      unitSupplierPriceToman: supplier?.supplierPriceToman,
      supplierIdSnapshot: supplier?.supplierId,
      supplierNameSnapshot: supplier?.supplier.name,
      platingType: item.platingType,
      platingWeightGrams,
      platingRateToman,
      unitPlatingPriceToman,
      platingLeadTimeDays,
      unitWeightGrams: variant.weightGrams?.toString(),
      lineTotalToman,
    };
  }

  private async reserveInventory(
    transaction: Prisma.TransactionClient,
    warehouseId: string,
    orderId: string,
    items: PreparedOrderItem[],
    actorUserId: string,
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

      if (!inventory || inventory.onHand - inventory.reserved < quantity) {
        throw new ConflictException('Insufficient inventory for one or more items.');
      }

      const nextReserved = inventory.reserved + quantity;
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
        throw new ConflictException('Inventory changed; please retry.');
      }

      await transaction.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          actorUserId,
          type: 'RESERVATION',
          onHandDelta: 0,
          reservedDelta: quantity,
          onHandAfter: inventory.onHand,
          reservedAfter: nextReserved,
          reason: 'Order inventory reservation',
          referenceType: 'ORDER',
          referenceId: orderId,
        },
      });
    }
  }

  private calculatePlatingPrice(weightGrams: string, pricePerGramToman: number): number {
    const [wholePart, fractionPart = ''] = weightGrams.split('.');
    const normalizedFraction = fractionPart.padEnd(3, '0').slice(0, 3);
    const milliGrams = BigInt(wholePart) * 1000n + BigInt(normalizedFraction || '0');
    const totalMilliToman = milliGrams * BigInt(pricePerGramToman);
    const roundedToman = (totalMilliToman + 500n) / 1000n;

    if (roundedToman > BigInt(TOMAN_INT_MAX)) {
      throw new BadRequestException('Calculated plating price exceeds the supported range.');
    }

    return Number(roundedToman);
  }

  private assertSafeTomanAmount(amount: number): void {
    if (!isNonNegativeTomanInt(amount)) {
      throw new BadRequestException('Calculated order amount exceeds the supported range.');
    }
  }

  private assertUniqueItemSelections(items: CreateOrderItemDto[]): void {
    const keys = items.map(({ variantId, platingType }) => `${variantId}:${platingType ?? 'NONE'}`);

    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate order item selections are not allowed.');
    }
  }
}
