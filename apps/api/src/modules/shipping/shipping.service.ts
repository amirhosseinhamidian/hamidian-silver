import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { isNonNegativeInt32 } from '../../common/int32';
import { lockOrderRowForUpdate } from '../../common/order-row-lock';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationOutboxEventType,
  OrderCostEntryType,
  OrderStatus,
  PaymentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from '../finance/order-costs.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { buildFulfillmentReadiness } from '../orders/fulfillment-readiness';
import { PROVIDER_CREATION_STALE_MS } from '../orders/fulfillment-sla.constants';
import { SelectShippingRateDto } from './dto/select-shipping-rate.dto';
import { ResetShipmentProviderCreationDto } from './dto/reset-shipment-provider-creation.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import {
  SHIPPING_PROVIDER,
  type CreateProviderShipmentResult,
  type ProviderShipmentTrackingStatus,
  type ShippingAddressSnapshot,
  type ShippingProvider,
  type ShippingQuoteOption,
} from './shipping-provider.port';
import { TRACKING_SYNC_LEASE_MS } from './shipping-tracking.constants';

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

const CUSTOMER_SHIPMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  providerServiceCode: true,
  providerServiceName: true,
  status: true,
  shippingCostToman: true,
  totalWeightGrams: true,
  estimatedDeliveryDays: true,
  trackingCode: true,
  shippedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
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
} satisfies Prisma.ShipmentSelect;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
    @Inject(NotificationOutboxService)
    private readonly outbox?: NotificationOutboxService,
    @Optional()
    @Inject(OrderCostsService)
    private readonly orderCosts: OrderCostsService | undefined = undefined,
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
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Selected shipping service is not available.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      await lockOrderRowForUpdate(transaction, orderId);

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
        throw new DomainException(ErrorCode.NOT_FOUND, 'Order was not found.');
      }

      if (currentOrder.status !== OrderStatus.PENDING_PAYMENT) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipping can no longer be changed for this order.',
        );
      }

      if (currentOrder.payment) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipping cannot be changed after payment initialization.',
        );
      }

      if (currentOrder.shipment && currentOrder.shipment.status !== ShipmentStatus.PENDING) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipment is already being processed.',
        );
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
        select: CUSTOMER_SHIPMENT_SELECT,
      });
    });
  }

  async createProviderShipment(orderId: string, actorUserId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: {
        orderId,
      },
      include: {
        order: {
          include: {
            shippingAddress: true,
            payment: {
              select: {
                status: true,
              },
            },
            platingFulfillment: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
    }

    if (
      shipment.order.status !== OrderStatus.PAID &&
      shipment.order.status !== OrderStatus.PROCESSING
    ) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Provider shipment can only be created after payment.',
      );
    }

    if (shipment.provider !== this.provider.providerCode) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Configured shipping provider does not match the selected shipment provider.',
      );
    }

    if (shipment.providerShipmentId) {
      return this.getShipment(orderId);
    }

    const readiness = buildFulfillmentReadiness({
      id: shipment.order.id,
      orderNumber: shipment.order.orderNumber,
      status: shipment.order.status,
      paidAt: shipment.order.paidAt,
      payment: shipment.order.payment,
      platingTotalToman: shipment.order.platingTotalToman,
      platingFulfillment: shipment.order.platingFulfillment,
      shipment: {
        id: shipment.id,
        status: shipment.status,
        provider: shipment.provider,
        providerCreationState: shipment.providerCreationState,
        providerShipmentId: shipment.providerShipmentId,
        providerCreateError: shipment.providerCreateError,
        creationAttemptedAt: shipment.creationAttemptedAt,
      },
    });

    if (!readiness.readyForShipmentCreation) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        `Order is not ready for provider shipment creation: ${readiness.blockers
          .map(({ code }) => code)
          .join(', ')}`,
      );
    }

    if (
      shipment.providerCreationState === ShipmentProviderCreationState.IN_PROGRESS ||
      shipment.providerCreationState === ShipmentProviderCreationState.UNKNOWN
    ) {
      throw new DomainException(
        ErrorCode.SHIPMENT_INVALID_STATUS,
        'Provider shipment creation is already in progress or needs reconciliation.',
      );
    }

    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new DomainException(
        ErrorCode.SHIPMENT_INVALID_STATUS,
        'Provider shipment can only be created from the pending shipment state.',
      );
    }

    const creationAttemptedAt = new Date();
    const claimed = await this.prisma.shipment.updateMany({
      where: {
        id: shipment.id,
        status: ShipmentStatus.PENDING,
        providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
        providerShipmentId: null,
        order: {
          payment: {
            is: {
              status: PaymentStatus.PAID,
            },
          },
        },
      },
      data: {
        providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
        creationAttemptedAt,
        providerCreateError: null,
      },
    });

    if (claimed.count !== 1) {
      throw new DomainException(
        ErrorCode.SHIPMENT_INVALID_STATUS,
        'Shipment creation state changed; reload before retrying.',
      );
    }

    try {
      const created = this.validateCreateShipmentResult(
        await this.provider.createShipment({
          orderNumber: shipment.order.orderNumber,
          serviceCode: shipment.providerServiceCode,
          totalWeightGrams: shipment.totalWeightGrams.toString(),
          declaredValueToman: this.calculateDeclaredValueToman({
            id: shipment.order.id,
            orderNumber: shipment.order.orderNumber,
            status: shipment.order.status,
            merchandiseTotalToman: shipment.order.merchandiseTotalToman,
            platingTotalToman: shipment.order.platingTotalToman,
            discountTotalToman: shipment.order.discountTotalToman,
            taxTotalToman: shipment.order.taxTotalToman,
            grandTotalToman: shipment.order.grandTotalToman,
            shippingAddress: shipment.order.shippingAddress,
            items: [],
          }),
          shippingCostToman: shipment.shippingCostToman,
          destination: this.requireShippingAddress(shipment.order.shippingAddress),
        }),
      );

      return this.prisma.$transaction(async (transaction) => {
        const current = await transaction.shipment.findUnique({
          where: {
            id: shipment.id,
          },
        });

        if (!current) {
          throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
        }

        if (current.providerShipmentId) {
          return transaction.shipment.findUniqueOrThrow({
            where: {
              id: current.id,
            },
            include: {
              statusHistory: {
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          });
        }

        if (current.providerCreationState !== ShipmentProviderCreationState.IN_PROGRESS) {
          throw new DomainException(
            ErrorCode.SHIPMENT_INVALID_STATUS,
            'Shipment creation state changed while contacting the provider.',
          );
        }

        const now = new Date();
        const finalized = await transaction.shipment.updateMany({
          where: {
            id: current.id,
            status: ShipmentStatus.PENDING,
            providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
            providerShipmentId: null,
          },
          data: {
            providerCreationState: ShipmentProviderCreationState.CREATED,
            providerShipmentId: created.providerShipmentId,
            trackingCode: created.trackingCode,
            providerCreateError: null,
            status: ShipmentStatus.READY,
          },
        });

        if (finalized.count !== 1) {
          throw new DomainException(
            ErrorCode.SHIPMENT_INVALID_STATUS,
            'Shipment creation state changed before provider result could be finalized.',
          );
        }

        const updated = await transaction.shipment.findUniqueOrThrow({
          where: {
            id: current.id,
          },
        });

        await transaction.shipmentStatusHistory.create({
          data: {
            shipmentId: current.id,
            actorUserId,
            fromStatus: current.status,
            toStatus: ShipmentStatus.READY,
            reason: 'Shipment created with shipping provider',
          },
        });

        if (created.actualCostToman !== undefined) {
          await this.orderCosts?.recordActualCost(transaction, {
            orderId: shipment.orderId,
            type: OrderCostEntryType.SHIPPING_PROVIDER,
            amountToman: created.actualCostToman,
            source: shipment.provider,
            externalReference: created.providerShipmentId,
            idempotencyKey: `shipment:${shipment.id}:provider-cost`,
            occurredAt: now,
            description: 'Actual shipping provider cost reported during shipment creation',
          });
        }

        if (created.trackingCode) {
          await this.outbox?.enqueueOrderEvent(transaction, {
            type: NotificationOutboxEventType.SHIPMENT_TRACKING_AVAILABLE,
            orderId: shipment.orderId,
            deduplicationKey: `shipment:${shipment.id}:tracking-available`,
            payload: {
              shipmentId: shipment.id,
              trackingCode: created.trackingCode,
            },
          });
        }

        return {
          ...updated,
          creationAttemptedAt: current.creationAttemptedAt ?? now,
        };
      });
    } catch (error) {
      await this.prisma.shipment.updateMany({
        where: {
          id: shipment.id,
          providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
          providerShipmentId: null,
        },
        data: {
          providerCreationState: ShipmentProviderCreationState.UNKNOWN,
          providerCreateError: this.safeErrorMessage(error),
        },
      });

      throw error;
    }
  }

  async syncTracking(orderId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: {
        orderId,
      },
      include: {
        order: true,
      },
    });

    if (!shipment) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
    }

    if (shipment.provider !== this.provider.providerCode) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Configured shipping provider does not match this shipment.',
      );
    }

    const providerShipmentId = shipment.providerShipmentId;

    if (!providerShipmentId) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Provider shipment must be created before tracking can be synchronized.',
      );
    }

    const trackingSyncToken = randomUUID();
    const trackingSyncStartedAt = new Date();
    const staleBefore = new Date(trackingSyncStartedAt.getTime() - TRACKING_SYNC_LEASE_MS);
    const lease = await this.prisma.shipment.updateMany({
      where: {
        id: shipment.id,
        providerShipmentId,
        OR: [
          {
            trackingSyncToken: null,
            trackingSyncStartedAt: null,
          },
          {
            trackingSyncToken: {
              not: null,
            },
            trackingSyncStartedAt: {
              lte: staleBefore,
            },
          },
        ],
      },
      data: {
        trackingSyncToken,
        trackingSyncStartedAt,
        trackingAttemptedAt: trackingSyncStartedAt,
      },
    });

    if (lease.count !== 1) {
      throw new DomainException(
        ErrorCode.SHIPMENT_INVALID_STATUS,
        'Shipment tracking synchronization is already in progress.',
      );
    }

    try {
      const tracked = await this.provider.track({
        providerShipmentId,
        trackingCode: shipment.trackingCode ?? undefined,
      });
      const syncedAt = new Date();

      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.shipment.findUnique({
          where: {
            id: shipment.id,
          },
          include: {
            order: true,
          },
        });

        if (!current) {
          throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
        }

        let nextStatus = current.status;
        let acceptProviderSnapshot = true;

        if (tracked.normalizedStatus) {
          const candidate = this.toShipmentStatus(tracked.normalizedStatus);

          if (
            candidate === current.status ||
            this.isAllowedProviderSyncTransition(current.status, candidate)
          ) {
            nextStatus = candidate;
          } else {
            acceptProviderSnapshot = false;
          }
        }

        const now = new Date();
        const finalized = await transaction.shipment.updateMany({
          where: {
            id: current.id,
            status: current.status,
            providerShipmentId,
            trackingSyncToken,
          },
          data: {
            status: nextStatus,
            lastProviderStatus: acceptProviderSnapshot
              ? tracked.providerStatus.slice(0, 255)
              : current.lastProviderStatus,
            lastProviderDescription: acceptProviderSnapshot
              ? tracked.description?.slice(0, 500)
              : current.lastProviderDescription,
            lastTrackingSyncAt: syncedAt,
            trackingSyncToken: null,
            trackingSyncStartedAt: null,
            shippedAt:
              nextStatus === ShipmentStatus.HANDED_OVER ||
              nextStatus === ShipmentStatus.IN_TRANSIT ||
              nextStatus === ShipmentStatus.DELIVERED
                ? (current.shippedAt ?? now)
                : current.shippedAt,
            deliveredAt:
              nextStatus === ShipmentStatus.DELIVERED
                ? (current.deliveredAt ?? now)
                : current.deliveredAt,
          },
        });

        if (finalized.count !== 1) {
          throw new DomainException(
            ErrorCode.SHIPMENT_INVALID_STATUS,
            'Shipment tracking response is stale or ownership changed; retry is required.',
          );
        }

        const updated = await transaction.shipment.findUniqueOrThrow({
          where: {
            id: current.id,
          },
        });

        if (nextStatus !== current.status) {
          await transaction.shipmentStatusHistory.create({
            data: {
              shipmentId: current.id,
              actorUserId: null,
              fromStatus: current.status,
              toStatus: nextStatus,
              reason: tracked.description
                ? `Provider tracking sync: ${tracked.description}`.slice(0, 500)
                : `Provider tracking sync: ${tracked.providerStatus}`.slice(0, 500),
            },
          });

          await this.syncOrderStatusForShipment(
            transaction,
            current.order,
            nextStatus,
            null,
            'Shipment status synchronized from provider',
          );
        }

        return updated;
      });
    } catch (error) {
      await this.prisma.shipment.updateMany({
        where: {
          id: shipment.id,
          trackingSyncToken,
        },
        data: {
          trackingSyncToken: null,
          trackingSyncStartedAt: null,
        },
      });

      throw error;
    }
  }

  async resetProviderCreation(
    orderId: string,
    dto: ResetShipmentProviderCreationDto,
    actorUserId: string,
  ) {
    if (!dto.confirmNoProviderShipment) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Confirm that no provider shipment exists before resetting creation.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const shipment = await transaction.shipment.findUnique({
        where: {
          orderId,
        },
      });

      if (!shipment) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
      }

      if (shipment.providerShipmentId) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Provider shipment already exists and cannot be reset.',
        );
      }

      const isUnknown = shipment.providerCreationState === ShipmentProviderCreationState.UNKNOWN;
      const isStaleInProgress =
        shipment.providerCreationState === ShipmentProviderCreationState.IN_PROGRESS &&
        shipment.creationAttemptedAt !== null &&
        Date.now() - shipment.creationAttemptedAt.getTime() >= PROVIDER_CREATION_STALE_MS;

      if (!isUnknown && !isStaleInProgress) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipment provider creation is not in a resettable state.',
        );
      }

      const reset = await transaction.shipment.updateMany({
        where: {
          id: shipment.id,
          status: shipment.status,
          providerCreationState: shipment.providerCreationState,
          providerShipmentId: null,
        },
        data: {
          providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
          creationAttemptedAt: null,
          providerCreateError: null,
        },
      });

      if (reset.count !== 1) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipment creation state changed while resetting; reload before retrying.',
        );
      }

      const updated = await transaction.shipment.findUniqueOrThrow({
        where: {
          id: shipment.id,
        },
      });

      await transaction.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          actorUserId,
          fromStatus: shipment.status,
          toStatus: shipment.status,
          reason: `Provider creation reset: ${dto.reason}`.slice(0, 500),
        },
      });

      return updated;
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
      select: CUSTOMER_SHIPMENT_SELECT,
    });

    if (!shipment) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
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
      throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
    }

    return shipment;
  }

  async updateStatus(orderId: string, dto: UpdateShipmentStatusDto, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const shipment = await transaction.shipment.findUnique({
        where: {
          orderId,
        },
        include: {
          order: {
            include: {
              payment: {
                select: {
                  status: true,
                },
              },
              platingFulfillment: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!shipment) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Shipment was not found.');
      }

      if (shipment.status === dto.status) {
        return shipment;
      }

      if (!this.isAllowedTransition(shipment.status, dto.status)) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'This shipment status transition is not allowed.',
        );
      }

      if (
        dto.status === ShipmentStatus.HANDED_OVER ||
        dto.status === ShipmentStatus.IN_TRANSIT ||
        dto.status === ShipmentStatus.DELIVERED
      ) {
        const readiness = buildFulfillmentReadiness({
          id: shipment.order.id,
          orderNumber: shipment.order.orderNumber,
          status: shipment.order.status,
          paidAt: shipment.order.paidAt,
          payment: shipment.order.payment,
          platingTotalToman: shipment.order.platingTotalToman,
          platingFulfillment: shipment.order.platingFulfillment,
          shipment: {
            id: shipment.id,
            status: shipment.status,
            provider: shipment.provider,
            providerCreationState: shipment.providerCreationState,
            providerShipmentId: shipment.providerShipmentId,
            providerCreateError: shipment.providerCreateError,
            creationAttemptedAt: shipment.creationAttemptedAt,
          },
        });

        if (!readiness.readyForHandoff) {
          throw new DomainException(
            ErrorCode.SHIPMENT_NOT_READY,
            `Order is not ready for shipment handoff: ${readiness.handoffBlockers
              .map(({ code }) => code)
              .join(', ')}`,
          );
        }
      }

      if (
        dto.providerShipmentId &&
        shipment.providerShipmentId &&
        dto.providerShipmentId !== shipment.providerShipmentId
      ) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Provider shipment ID cannot be replaced once stored.',
        );
      }

      if (dto.trackingCode && shipment.trackingCode && dto.trackingCode !== shipment.trackingCode) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Tracking code cannot be replaced once stored.',
        );
      }

      const now = new Date();
      const claimed = await transaction.shipment.updateMany({
        where: {
          id: shipment.id,
          status: shipment.status,
          ...(dto.status === ShipmentStatus.HANDED_OVER
            ? {
                order: {
                  payment: {
                    is: {
                      status: PaymentStatus.PAID,
                    },
                  },
                },
              }
            : {}),
        },
        data: {
          status: dto.status,
          trackingCode: dto.trackingCode,
          providerShipmentId: dto.providerShipmentId,
          providerCreationState: dto.providerShipmentId
            ? ShipmentProviderCreationState.CREATED
            : shipment.providerCreationState,
          providerCreateError: dto.providerShipmentId ? null : shipment.providerCreateError,
          shippedAt:
            dto.status === ShipmentStatus.HANDED_OVER ||
            dto.status === ShipmentStatus.IN_TRANSIT ||
            dto.status === ShipmentStatus.DELIVERED
              ? (shipment.shippedAt ?? now)
              : shipment.shippedAt,
          deliveredAt:
            dto.status === ShipmentStatus.DELIVERED
              ? (shipment.deliveredAt ?? now)
              : shipment.deliveredAt,
        },
      });

      if (claimed.count !== 1) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Shipment state changed; reload and retry the status update.',
        );
      }

      const updated = await transaction.shipment.findUniqueOrThrow({
        where: {
          id: shipment.id,
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

      if (!shipment.trackingCode && dto.trackingCode) {
        await this.outbox?.enqueueOrderEvent(transaction, {
          type: NotificationOutboxEventType.SHIPMENT_TRACKING_AVAILABLE,
          orderId: shipment.orderId,
          deduplicationKey: `shipment:${shipment.id}:tracking-available`,
          payload: {
            shipmentId: shipment.id,
            trackingCode: dto.trackingCode,
          },
        });
      }

      await this.syncOrderStatusForShipment(
        transaction,
        shipment.order,
        dto.status,
        actorUserId,
        dto.reason ?? 'Shipment status updated',
      );

      return updated;
    });
  }

  private async syncOrderStatusForShipment(
    transaction: Prisma.TransactionClient,
    order: {
      id: string;
      status: OrderStatus;
      deliveredAt: Date | null;
    },
    shipmentStatus: ShipmentStatus,
    actorUserId: string | null,
    reason: string,
  ): Promise<void> {
    const target =
      shipmentStatus === ShipmentStatus.DELIVERED
        ? OrderStatus.DELIVERED
        : shipmentStatus === ShipmentStatus.HANDED_OVER ||
            shipmentStatus === ShipmentStatus.IN_TRANSIT
          ? OrderStatus.SHIPPED
          : undefined;

    if (!target) {
      return;
    }

    const rank: Record<OrderStatus, number> = {
      [OrderStatus.PENDING_PAYMENT]: 0,
      [OrderStatus.PAID]: 1,
      [OrderStatus.PROCESSING]: 2,
      [OrderStatus.SHIPPED]: 3,
      [OrderStatus.DELIVERED]: 4,
      [OrderStatus.CANCELLED]: -1,
      [OrderStatus.EXPIRED]: -1,
    };

    if (rank[order.status] < 1) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Shipment cannot advance an unpaid or closed order.',
      );
    }

    const steps =
      target === OrderStatus.DELIVERED
        ? [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
        : [OrderStatus.PROCESSING, OrderStatus.SHIPPED];

    let currentStatus = order.status;

    for (const nextStatus of steps) {
      if (rank[currentStatus] >= rank[nextStatus]) {
        continue;
      }

      const deliveredAt =
        nextStatus === OrderStatus.DELIVERED
          ? (order.deliveredAt ?? new Date())
          : order.deliveredAt;

      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: currentStatus,
        },
        data: {
          status: nextStatus,
          deliveredAt,
        },
      });

      if (claimed.count !== 1) {
        throw new DomainException(
          ErrorCode.SHIPMENT_INVALID_STATUS,
          'Order state changed while synchronizing shipment status; retry is required.',
        );
      }

      await transaction.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorUserId,
          fromStatus: currentStatus,
          toStatus: nextStatus,
          reason: reason.slice(0, 500),
        },
      });

      if (nextStatus === OrderStatus.SHIPPED) {
        await this.outbox?.enqueueOrderEvent(transaction, {
          type: NotificationOutboxEventType.ORDER_SHIPPED,
          orderId: order.id,
          deduplicationKey: `order:${order.id}:shipped`,
          payload: {},
        });
      }

      if (nextStatus === OrderStatus.DELIVERED) {
        await this.outbox?.enqueueOrderEvent(transaction, {
          type: NotificationOutboxEventType.ORDER_DELIVERED,
          orderId: order.id,
          deduplicationKey: `order:${order.id}:delivered`,
          payload: {},
        });
      }

      currentStatus = nextStatus;
    }
  }

  private toShipmentStatus(status: ProviderShipmentTrackingStatus): ShipmentStatus {
    switch (status) {
      case 'HANDED_OVER':
        return ShipmentStatus.HANDED_OVER;
      case 'IN_TRANSIT':
        return ShipmentStatus.IN_TRANSIT;
      case 'DELIVERED':
        return ShipmentStatus.DELIVERED;
      case 'FAILED':
        return ShipmentStatus.FAILED;
    }
  }

  private isAllowedProviderSyncTransition(current: ShipmentStatus, next: ShipmentStatus): boolean {
    if (next === ShipmentStatus.FAILED) {
      return (
        current !== ShipmentStatus.DELIVERED &&
        current !== ShipmentStatus.CANCELLED &&
        current !== ShipmentStatus.FAILED
      );
    }

    const rank: Partial<Record<ShipmentStatus, number>> = {
      [ShipmentStatus.READY]: 1,
      [ShipmentStatus.HANDED_OVER]: 2,
      [ShipmentStatus.IN_TRANSIT]: 3,
      [ShipmentStatus.DELIVERED]: 4,
    };

    const currentRank = rank[current];
    const nextRank = rank[next];

    return currentRank !== undefined && nextRank !== undefined && nextRank > currentRank;
  }

  private safeErrorMessage(error: unknown): string {
    return (
      error instanceof Error
        ? error.message
        : 'Shipping provider creation failed with an unknown error.'
    ).slice(0, 500);
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
          throw new DomainException(ErrorCode.NOT_FOUND, 'Order was not found.');
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
      throw new DomainException(
        ErrorCode.SHIPMENT_INVALID_STATUS,
        'Shipping can only be selected before payment.',
      );
    }
  }

  private requireShippingAddress(address: ShippingAddressSnapshot | null): ShippingAddressSnapshot {
    if (!address) {
      throw new DomainException(ErrorCode.SHIPMENT_NOT_READY, 'Order shipping address is missing.');
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
        throw new DomainException(
          ErrorCode.SHIPMENT_NOT_READY,
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
      throw new DomainException(ErrorCode.SHIPMENT_NOT_READY, 'Order item weight is invalid.');
    }

    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  }

  private validateQuoteOption(option: ShippingQuoteOption): ShippingQuoteOption {
    if (
      !option.serviceCode.trim() ||
      option.serviceCode.length > 120 ||
      (option.serviceName !== undefined && option.serviceName.length > 200) ||
      !isNonNegativeTomanInt(option.costToman) ||
      (option.estimatedDeliveryDays !== undefined &&
        !isNonNegativeInt32(option.estimatedDeliveryDays))
    ) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Shipping provider returned an invalid quote.',
      );
    }

    return option;
  }

  private validateCreateShipmentResult(
    result: CreateProviderShipmentResult,
  ): CreateProviderShipmentResult {
    if (
      !result.providerShipmentId.trim() ||
      result.providerShipmentId.length > 255 ||
      (result.trackingCode !== undefined &&
        (!result.trackingCode.trim() || result.trackingCode.length > 255)) ||
      (result.actualCostToman !== undefined && !isNonNegativeTomanInt(result.actualCostToman))
    ) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Shipping provider returned invalid shipment creation data.',
      );
    }

    return result;
  }

  private assertTomanAmount(amount: number): void {
    if (!isNonNegativeTomanInt(amount)) {
      throw new DomainException(
        ErrorCode.SHIPMENT_NOT_READY,
        'Calculated order amount exceeds the supported range.',
      );
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
