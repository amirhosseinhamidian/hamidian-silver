import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SelectShippingRateDto } from './dto/select-shipping-rate.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  SHIPPING_PROVIDER,
  type ShippingAddressSnapshot,
  type ShippingProvider,
  type ShippingQuoteOption,
} from './shipping-provider.port';

type OrderForShipping = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;
  shippingAddress: ShippingAddressSnapshot | null;
  items: Array<{
    quantity: number;
    unitWeightGrams: { toString(): string } | null;
  }>;
};

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
  ) {}

  async quoteOrder(userId: string, orderId: string) {
    const order = await this.loadUserOrderForShipping(userId, orderId);
    this.assertOrderCanSelectShipping(order);

    const totalWeightGrams = this.calculateTotalWeightGrams(order.items);
    const options = await this.provider.quote({
      orderNumber: order.orderNumber,
      totalWeightGrams,
      declaredValueToman: this.calculateDeclaredValueToman(order),
      destination: this.requireShippingAddress(order.shippingAddress),
    });

    return {
      provider: this.provider.providerCode,
      totalWeightGrams,
      options: options.map((option) => this.validateQuoteOption(option)),
    };
  }

  async selectRate(userId: string, orderId: string, dto: SelectShippingRateDto) {
    const order = await this.loadUserOrderForShipping(userId, orderId);
    this.assertOrderCanSelectShipping(order);

    const totalWeightGrams = this.calculateTotalWeightGrams(order.items);
    const options = await this.provider.quote({
      orderNumber: order.orderNumber,
      totalWeightGrams,
      declaredValueToman: this.calculateDeclaredValueToman(order),
      destination: this.requireShippingAddress(order.shippingAddress),
    });

    const selected = options
      .map((option) => this.validateQuoteOption(option))
      .find((option) => option.serviceCode === dto.serviceCode);

    if (!selected) {
      throw new BadRequestException('Selected shipping service is not available.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: {
          payment: {
            select: {
              id: true,
            },
          },
          shipment: true,
        },
      });

      if (!currentOrder) {
        throw new NotFoundException('Order was not found.');
      }

      if (currentOrder.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictException('Shipping can no longer be changed for this order.');
      }

      if (currentOrder.payment) {
        throw new ConflictException('Shipping cannot be changed after payment initialization.');
      }

      if (currentOrder.shipment && currentOrder.shipment.status !== ShipmentStatus.PENDING) {
        throw new ConflictException('Shipment is already being processed.');
      }

      const baseTotal =
        currentOrder.merchandiseTotalToman +
        currentOrder.platingTotalToman -
        currentOrder.discountTotalToman +
        currentOrder.taxTotalToman;
      const grandTotalToman = baseTotal + selected.costToman;

      this.assertTomanAmount(grandTotalToman);

      const shipment = await transaction.shipment.upsert({
        where: {
          orderId,
        },
        update: {
          provider: this.provider.providerCode,
          providerServiceCode: selected.serviceCode,
          providerServiceName: selected.serviceName,
          shippingCostToman: selected.costToman,
          totalWeightGrams,
          estimatedDeliveryDays: selected.estimatedDeliveryDays,
        },
        create: {
          orderId,
          provider: this.provider.providerCode,
          providerServiceCode: selected.serviceCode,
          providerServiceName: selected.serviceName,
          shippingCostToman: selected.costToman,
          totalWeightGrams,
          estimatedDeliveryDays: selected.estimatedDeliveryDays,
        },
      });

      if (!currentOrder.shipment) {
        await transaction.shipmentStatusHistory.create({
          data: {
            shipmentId: shipment.id,
            actorUserId: userId,
            fromStatus: null,
            toStatus: ShipmentStatus.PENDING,
            reason: 'Shipping service selected',
          },
        });
      }

      await transaction.order.update({
        where: {
          id: orderId,
        },
        data: {
          shippingTotalToman: selected.costToman,
          grandTotalToman,
        },
      });

      return transaction.shipment.findUniqueOrThrow({
        where: {
          id: shipment.id,
        },
        include: {
          statusHistory: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
    });
  }

  async getMyShipment(userId: string, orderId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        orderId,
        order: {
          userId,
        },
      },
      include: {
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment was not found.');
    }

    return shipment;
  }

  async getShipment(orderId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: {
        orderId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shippingAddress: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment was not found.');
    }

    return shipment;
  }

  async updateStatus(orderId: string, dto: UpdateShipmentStatusDto, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const shipment = await transaction.shipment.findUnique({
        where: {
          orderId,
        },
      });

      if (!shipment) {
        throw new NotFoundException('Shipment was not found.');
      }

      if (shipment.status === dto.status) {
        return shipment;
      }

      if (!this.isAllowedTransition(shipment.status, dto.status)) {
        throw new BadRequestException('This shipment status transition is not allowed.');
      }

      const now = new Date();
      const updated = await transaction.shipment.update({
        where: {
          id: shipment.id,
        },
        data: {
          status: dto.status,
          trackingCode: dto.trackingCode,
          providerShipmentId: dto.providerShipmentId,
          shippedAt:
            dto.status === ShipmentStatus.HANDED_OVER || dto.status === ShipmentStatus.IN_TRANSIT
              ? (shipment.shippedAt ?? now)
              : shipment.shippedAt,
          deliveredAt:
            dto.status === ShipmentStatus.DELIVERED
              ? (shipment.deliveredAt ?? now)
              : shipment.deliveredAt,
        },
      });

      await transaction.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          actorUserId,
          fromStatus: shipment.status,
          toStatus: dto.status,
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  private loadUserOrderForShipping(userId: string, orderId: string): Promise<OrderForShipping> {
    return this.prisma.order
      .findFirst({
        where: {
          id: orderId,
          userId,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          merchandiseTotalToman: true,
          platingTotalToman: true,
          discountTotalToman: true,
          taxTotalToman: true,
          grandTotalToman: true,
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
          items: {
            select: {
              quantity: true,
              unitWeightGrams: true,
            },
          },
        },
      })
      .then((order) => {
        if (!order) {
          throw new NotFoundException('Order was not found.');
        }

        return order;
      });
  }

  private calculateDeclaredValueToman(order: OrderForShipping): number {
    const declaredValueToman =
      order.merchandiseTotalToman +
      order.platingTotalToman -
      order.discountTotalToman +
      order.taxTotalToman;

    this.assertTomanAmount(declaredValueToman);

    return declaredValueToman;
  }

  private assertOrderCanSelectShipping(order: OrderForShipping): void {
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Shipping can only be selected before payment.');
    }
  }

  private requireShippingAddress(address: ShippingAddressSnapshot | null): ShippingAddressSnapshot {
    if (!address) {
      throw new BadRequestException('Order shipping address is missing.');
    }

    return address;
  }

  private calculateTotalWeightGrams(
    items: Array<{
      quantity: number;
      unitWeightGrams: { toString(): string } | null;
    }>,
  ): string {
    let totalMilliGrams = 0n;

    for (const item of items) {
      if (!item.unitWeightGrams) {
        throw new BadRequestException(
          'Every order item needs a weight before shipping can be quoted.',
        );
      }

      const unitMilliGrams = this.decimalGramsToMilliGrams(item.unitWeightGrams.toString());
      totalMilliGrams += unitMilliGrams * BigInt(item.quantity);
    }

    const whole = totalMilliGrams / 1000n;
    const fraction = (totalMilliGrams % 1000n).toString().padStart(3, '0');

    return `${whole}.${fraction}`;
  }

  private decimalGramsToMilliGrams(value: string): bigint {
    if (!/^\d+(?:\.\d{1,3})?$/.test(value)) {
      throw new BadRequestException('Order item weight is invalid.');
    }

    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  }

  private validateQuoteOption(option: ShippingQuoteOption): ShippingQuoteOption {
    if (
      !option.serviceCode ||
      !Number.isSafeInteger(option.costToman) ||
      option.costToman < 0 ||
      (option.estimatedDeliveryDays !== undefined &&
        (!Number.isInteger(option.estimatedDeliveryDays) || option.estimatedDeliveryDays < 0))
    ) {
      throw new BadRequestException('Shipping provider returned an invalid quote.');
    }

    return option;
  }

  private assertTomanAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new BadRequestException('Calculated order amount exceeds the supported range.');
    }
  }

  private isAllowedTransition(current: ShipmentStatus, next: ShipmentStatus): boolean {
    const transitions: Record<ShipmentStatus, ShipmentStatus[]> = {
      [ShipmentStatus.PENDING]: [
        ShipmentStatus.READY,
        ShipmentStatus.CANCELLED,
        ShipmentStatus.FAILED,
      ],
      [ShipmentStatus.READY]: [
        ShipmentStatus.HANDED_OVER,
        ShipmentStatus.CANCELLED,
        ShipmentStatus.FAILED,
      ],
      [ShipmentStatus.HANDED_OVER]: [
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
      ],
      [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED],
      [ShipmentStatus.DELIVERED]: [],
      [ShipmentStatus.FAILED]: [],
      [ShipmentStatus.CANCELLED]: [],
    };

    return transitions[current].includes(next);
  }
}
