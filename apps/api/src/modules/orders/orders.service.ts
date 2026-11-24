import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/errors/domain-exception';

import { ErrorCode } from '../../common/errors/error-codes';
import { randomUUID } from 'node:crypto';
import { calculatePlatingPriceToman } from '../../common/plating-price';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationOutboxEventType,
  OrderStatus,
  PaymentRefundStatus,
  PaymentStatus,
  PlatingType,
  ProductStatus,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { normalizeIranianMobile } from '../auth/phone-normalizer';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { releaseCampaignQuota } from '../campaigns/campaign-quota';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { attributionPolicy, buildOrderAttribution } from '../growth-attribution/attribution';
import {
  createQuoteToken,
  matchesQuote,
  parseQuoteToken,
  quoteTokenHash,
} from '../promotions/promotion-quote';
import { normalizeCoupon, PromotionsService } from '../promotions/promotions.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { ShippingPricingService } from '../shipping/shipping-pricing.service';
import { ShippingCarriersService } from '../shipping/shipping-carriers.service';
import { resolveVariantInventoryRequirements } from '../inventory/variant-inventory-requirements';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderAddressDto, CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const RESERVATION_TTL_MINUTES = 15;

const LEGACY_CANCELLATION_REASON_TRANSLATIONS = new Map<string, string>([
  ['cancelled by customer', 'لغو سفارش توسط مشتری'],
  ['canceled by customer', 'لغو سفارش توسط مشتری'],
  ['customer cancellation', 'لغو سفارش توسط مشتری'],
  ['order cancelled by customer', 'لغو سفارش توسط مشتری'],
  ['order canceled by customer', 'لغو سفارش توسط مشتری'],
  ['manager cancellation', 'لغو سفارش توسط مدیریت'],
  ['cancelled by manager', 'لغو سفارش توسط مدیریت'],
  ['canceled by manager', 'لغو سفارش توسط مدیریت'],
  ['cancelled by management', 'لغو سفارش توسط مدیریت'],
  ['canceled by management', 'لغو سفارش توسط مدیریت'],
]);

function customerFacingCancellationReason(reason: string | null | undefined): string | null {
  const normalizedReason = reason?.trim();
  if (!normalizedReason) return null;

  return (
    LEGACY_CANCELLATION_REASON_TRANSLATIONS.get(normalizedReason.toLowerCase()) ?? normalizedReason
  );
}

type ShippingCarrierPresentation = Readonly<{
  name: string | null;
  trackingUrl: string | null;
  logoUrl: string | null;
}>;

function publicShippingMethodName(
  shipment: Readonly<{
    provider: string;
    providerServiceName: string | null;
    carrierNameSnapshot: string | null;
    carrierPresentationSnapshottedAt: Date | null;
  }> | null,
  fallback: ShippingCarrierPresentation | null,
): string | null {
  if (!shipment) return null;
  if (shipment.carrierPresentationSnapshottedAt) {
    return shipment.carrierNameSnapshot ?? shipment.providerServiceName ?? shipment.provider;
  }
  if (fallback?.name) return fallback.name;
  if (shipment.providerServiceName) return shipment.providerServiceName;
  if (shipment.provider.toLowerCase() === 'postex') return 'پستکس';
  if (shipment.provider.toLowerCase() === 'manual') return 'ارسال فروشگاه';
  return shipment.provider;
}

const ORDER_ITEM_PRODUCT_PRESENTATION_SELECT = {
  slug: true,
  media: {
    where: {
      media: {
        deletedAt: null,
      },
    },
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
    select: {
      altText: true,
      media: {
        select: {
          storageKey: true,
          mimeType: true,
          altText: true,
          width: true,
          height: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

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
  returnAllocatedQuantity: true,
  createdAt: true,
  variant: {
    select: {
      product: {
        select: ORDER_ITEM_PRODUCT_PRESENTATION_SELECT,
      },
    },
  },
} satisfies Prisma.OrderItemSelect;

const CUSTOMER_ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  merchandiseTotalToman: true,
  platingTotalToman: true,
  discountTotalToman: true,
  shippingTotalToman: true,
  shippingCarrierNameSnapshot: true,
  shippingCarrierTrackingUrlSnapshot: true,
  shippingPricingModeSnapshot: true,
  shippingDeliveryTypeSnapshot: true,
  shippingCarrierLogoSnapshot: { select: { storageKey: true } },
  taxTotalToman: true,
  grandTotalToman: true,
  reservationExpiresAt: true,
  paidAt: true,
  cancelledAt: true,
  deliveredAt: true,
  returnAuthorizedAt: true,
  createdAt: true,
  updatedAt: true,
  shipment: {
    select: {
      provider: true,
      providerServiceCode: true,
      providerServiceName: true,
      carrierNameSnapshot: true,
      carrierTrackingUrlSnapshot: true,
      carrierLogoSnapshot: { select: { storageKey: true } },
      carrierPresentationSnapshottedAt: true,
      trackingCode: true,
      deliveryTypeSnapshot: true,
    },
  },
  payment: {
    select: {
      status: true,
      attempts: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          provider: true,
          receiptOriginalName: true,
          receiptUploadedAt: true,
        },
      },
    },
  },
  items: {
    select: CUSTOMER_ORDER_ITEM_SELECT,
  },
} satisfies Prisma.OrderSelect;

const CUSTOMER_ORDER_DETAIL_SELECT = {
  ...CUSTOMER_ORDER_LIST_SELECT,
  customerNote: true,
  payment: {
    select: {
      status: true,
      refunds: {
        where: { status: PaymentRefundStatus.CONFIRMED, confirmedAt: { not: null } },
        orderBy: [{ confirmedAt: 'asc' as const }, { id: 'asc' as const }],
        select: { id: true, amountToman: true, confirmedAt: true },
      },
      attempts: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          provider: true,
          failureCode: true,
          failureMessage: true,
          receiptOriginalName: true,
          receiptUploadedAt: true,
        },
      },
    },
  },
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
      reason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

const ADMIN_ORDER_LIST_INCLUDE = {
  user: {
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  },
  returnAuthorizedBy: {
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  },
  items: {
    include: {
      variant: {
        select: {
          product: {
            select: ORDER_ITEM_PRODUCT_PRESENTATION_SELECT,
          },
        },
      },
    },
  },
  shippingAddress: true,
  payment: {
    select: {
      id: true,
      status: true,
      amountToman: true,
      refundedAmountToman: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      attempts: {
        take: 3,
        orderBy: {
          createdAt: 'desc' as const,
        },
        select: {
          id: true,
          provider: true,
          status: true,
          amountToman: true,
          providerReference: true,
          failureCode: true,
          failureMessage: true,
          verifiedAt: true,
          receiptMimeType: true,
          receiptOriginalName: true,
          receiptSizeBytes: true,
          receiptUploadedAt: true,
          createdAt: true,
        },
      },
    },
  },
  shipment: {
    select: {
      id: true,
      provider: true,
      providerServiceCode: true,
      providerServiceName: true,
      status: true,
      providerCreationState: true,
      shippingCostToman: true,
      totalWeightGrams: true,
      estimatedDeliveryDays: true,
      providerShipmentId: true,
      trackingCode: true,
      deliveryTypeSnapshot: true,
      shippedAt: true,
      deliveredAt: true,
      createdAt: true,
      updatedAt: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
          actor: {
            select: { id: true, phone: true, firstName: true, lastName: true },
          },
        },
      },
    },
  },
  statusHistory: {
    orderBy: {
      createdAt: 'asc' as const,
    },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type CustomerOrderListRecord = Prisma.OrderGetPayload<{
  select: typeof CUSTOMER_ORDER_LIST_SELECT;
}>;

type CustomerOrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof CUSTOMER_ORDER_DETAIL_SELECT;
}>;

type AdminOrderListRecord = Prisma.OrderGetPayload<{
  include: typeof ADMIN_ORDER_LIST_INCLUDE;
}>;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrl?: PublicMediaUrlService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly shippingPricing?: ShippingPricingService,
    @Optional() private readonly shippingCarriers?: ShippingCarriersService,
    @Optional() private readonly outbox?: NotificationOutboxService,
    @Optional() private readonly promotions?: PromotionsService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    this.assertUniqueItemSelections(dto.items);
    const customerNote = dto.customerNote?.trim() || null;
    const quote = dto.quoteToken ? parseQuoteToken(dto.quoteToken) : null;
    if ((dto.quoteToken && !quote) || (dto.couponCode && !quote)) throw this.quoteChanged();
    const tokenHash = dto.quoteToken ? quoteTokenHash(dto.quoteToken) : null;

    const order = await this.prisma.$transaction(async (transaction) => {
      if (quote && tokenHash) {
        await transaction.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${quote.orderId}, 0))`;
        const existing = await transaction.order.findFirst({
          where: { id: quote.orderId, userId, priceQuote: { tokenHash } },
          select: CUSTOMER_ORDER_DETAIL_SELECT,
        });
        if (existing) return existing;
        if (quote.expiresAt <= Date.now() || !this.promotions) throw this.quoteChanged();
        if (quote.campaignId) await this.promotions.lockCampaign(transaction, quote.campaignId);
      }
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

      const { preparedItems, shippingSelection, totals, promotion, binding } =
        await this.priceOrder(transaction, userId, dto, shippingAddress, Boolean(quote));
      if (
        quote &&
        (quote.campaignId !== (promotion?.campaignId ?? null) ||
          !matchesQuote(this.quoteSecret(), quote, binding, new Date()))
      ) {
        throw this.quoteChanged();
      }
      const {
        merchandiseTotalToman,
        platingTotalToman,
        shippingTotalToman,
        payableToman: grandTotalToman,
      } = totals;
      const orderId = quote?.orderId ?? randomUUID();
      const orderNumber = `HS-${orderId.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
      const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const attribution = await buildOrderAttribution(
        transaction,
        dto.attribution,
        attributionPolicy(this.config),
      );

      const order = await transaction.order.create({
        data: {
          id: orderId,
          orderNumber,
          userId,
          warehouseId: warehouse.id,
          status: OrderStatus.PENDING_PAYMENT,
          merchandiseTotalToman,
          platingTotalToman,
          shippingTotalToman,
          ...shippingSelection.snapshot,
          grandTotalToman,
          ...(promotion?.quotaAllocations?.length
            ? {
                campaignQuotaRestricted: true,
                campaignQuotaAllocations: { createMany: { data: promotion.quotaAllocations } },
              }
            : {}),
          ...(quote && tokenHash
            ? {
                discountTotalToman: totals.discountTotalToman,
                priceQuote: {
                  create: {
                    tokenHash,
                    campaignId: promotion?.campaignId ?? null,
                    merchandiseDiscountToman: totals.discountTotalToman,
                    shippingDiscountToman: totals.shippingDiscountToman,
                    snapshot: {
                      version: 1,
                      ...totals,
                      baseShippingToman: shippingSelection.costToman,
                      rule: promotion?.rule ?? null,
                      items: preparedItems.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                        unitSalePriceToman: item.unitSalePriceToman,
                        unitPlatingPriceToman: item.unitPlatingPriceToman,
                        platingType: item.platingType ?? null,
                      })),
                    },
                  },
                },
              }
            : {}),
          customerNote,
          reservationExpiresAt,
          ...(dto.growthDevice ? { growthDevice: dto.growthDevice } : {}),
          ...(attribution ? { attribution: { create: attribution } } : {}),
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

    return this.toCustomerOrder(order, null);
  }

  async estimatePromotions(items: CreateOrderItemDto[]) {
    this.assertUniqueItemSelections(items);
    return this.prisma.$transaction(async (tx) => {
      const { lines, merchandiseTotalToman, platingTotalToman } = await this.preparePricingItems(
        tx,
        items,
      );
      const promotion = await this.promotions?.apply(tx, lines, 0, new Date(), null);
      return this.promotionTotals(merchandiseTotalToman, platingTotalToman, 0, promotion);
    });
  }

  async quotePrice(userId: string, dto: CreateOrderDto) {
    if (dto.items.length > 100)
      throw new BadRequestException('A quote can contain up to 100 lines.');
    this.assertUniqueItemSelections(dto.items);
    return this.prisma.$transaction(async (tx) => {
      const address = await this.resolveShippingAddress(tx, userId, dto);
      const priced = await this.priceOrder(tx, userId, dto, address, true);
      if (priced.binding.coupon && !priced.promotion) {
        throw new BadRequestException('The coupon is unavailable for this basket.');
      }
      return {
        ...priced.totals,
        ...createQuoteToken(
          this.quoteSecret(),
          priced.promotion?.campaignId ?? null,
          priced.binding,
          new Date(),
        ),
      };
    });
  }

  private quoteSecret() {
    const secret = this.config?.get<string>('OTP_PEPPER');
    if (!secret) throw new Error('Checkout quote signing is unavailable.');
    return secret;
  }

  private quoteChanged() {
    return new DomainException(
      ErrorCode.ORDER_PRICE_QUOTE_CHANGED,
      'The checkout quote changed or expired.',
    );
  }

  private async preparePricingItems(
    transaction: Prisma.TransactionClient,
    items: CreateOrderItemDto[],
  ) {
    const variantIds = [...new Set(items.map(({ variantId }) => variantId))];
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
            categories: {
              where: { category: { isActive: true, deletedAt: null } },
              select: { categoryId: true },
            },
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
    const preparedItems = items.map((item) => {
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
    this.assertSafeTomanAmount(merchandiseTotalToman);
    this.assertSafeTomanAmount(platingTotalToman);
    const lines = preparedItems.map((item) => {
      const variant = variantById.get(item.variantId)!;
      return {
        productId: variant.productId,
        categoryIds: variant.product.categories?.map(({ categoryId }) => categoryId) ?? [],
        unitSalePriceToman: item.unitSalePriceToman,
        quantity: item.quantity,
      };
    });
    return { preparedItems, lines, merchandiseTotalToman, platingTotalToman };
  }

  private async priceOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
    address: CreateOrderAddressDto,
    usePromotions: boolean,
  ) {
    const { preparedItems, lines, merchandiseTotalToman, platingTotalToman } =
      await this.preparePricingItems(tx, dto.items);
    const shippingSelection = await this.resolveShippingSelection(
      dto.shippingCarrierId,
      merchandiseTotalToman + platingTotalToman,
      address,
      tx,
    );
    const baseShipping = shippingSelection.costToman;
    const coupon = usePromotions ? normalizeCoupon(dto.couponCode) : null;
    const promotion = usePromotions
      ? await this.promotions?.apply(tx, lines, baseShipping, new Date(), coupon, userId)
      : null;
    const totals = this.promotionTotals(
      merchandiseTotalToman,
      platingTotalToman,
      baseShipping,
      promotion,
    );
    const binding = {
      userId,
      address,
      coupon,
      shippingCarrierId: dto.shippingCarrierId ?? null,
      shippingSelection,
      totals,
      promotion,
      items: preparedItems.map(
        ({ variantId, quantity, platingType, unitSalePriceToman, unitPlatingPriceToman }) => ({
          variantId,
          quantity,
          platingType,
          unitSalePriceToman,
          unitPlatingPriceToman,
        }),
      ),
    };
    return { preparedItems, shippingSelection, promotion, totals, binding };
  }

  private promotionTotals(
    merchandiseTotalToman: number,
    platingTotalToman: number,
    baseShippingToman: number,
    promotion?: {
      merchandiseDiscountToman: number;
      shippingDiscountToman: number;
      campaignName: string;
    } | null,
  ) {
    const discountTotalToman = promotion?.merchandiseDiscountToman ?? 0;
    const shippingDiscountToman = promotion?.shippingDiscountToman ?? 0;
    const shippingTotalToman = baseShippingToman - shippingDiscountToman;
    const walletAppliedToman = 0;
    const payableToman =
      merchandiseTotalToman +
      platingTotalToman -
      discountTotalToman +
      shippingTotalToman -
      walletAppliedToman;
    this.assertSafeTomanAmount(baseShippingToman);
    this.assertSafeTomanAmount(payableToman);
    return {
      merchandiseTotalToman,
      platingTotalToman,
      discountTotalToman,
      shippingTotalToman,
      shippingDiscountToman,
      walletAppliedToman,
      payableToman,
      campaignName: promotion?.campaignName ?? null,
    };
  }

  private async resolveInitialShippingCostToman(
    cartSubtotalToman: number,
    transaction: Prisma.TransactionClient,
  ): Promise<number> {
    const shippingProvider =
      this.config?.get<string>('SHIPPING_PROVIDER', 'disabled') ?? 'disabled';

    if (shippingProvider !== 'disabled') return 0;

    if (this.shippingPricing) {
      return this.shippingPricing.calculateCostToman(cartSubtotalToman, transaction);
    }

    return this.config?.get<number>('MANUAL_SHIPPING_COST_TOMAN', 0) ?? 0;
  }

  private async resolveShippingSelection(
    carrierId: string | undefined,
    cartSubtotalToman: number,
    destination: Readonly<{ province: string; city: string }>,
    transaction: Prisma.TransactionClient,
  ) {
    if (this.shippingCarriers) {
      if (!carrierId) throw new BadRequestException('Select a shipping carrier.');
      return this.shippingCarriers.quoteForCheckout(
        carrierId,
        cartSubtotalToman,
        destination,
        transaction,
      );
    }
    return {
      costToman: await this.resolveInitialShippingCostToman(cartSubtotalToman, transaction),
      snapshot: {},
    };
  }

  async listMyOrders(userId: string, query: ListOrdersQueryDto) {
    const orders = await this.prisma.order.findMany({
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

    const carrier = await this.shippingPricing?.getPublicCarrierPresentation();
    return orders.map((order) => this.toCustomerOrder(order, carrier ?? null));
  }

  async countMyOrders(userId: string) {
    const count = await this.prisma.order.count({ where: { userId } });
    return { count };
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
      throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
    }

    const carrier = await this.shippingPricing?.getPublicCarrierPresentation();
    return this.toCustomerOrder(order, carrier ?? null);
  }

  private toCustomerOrder(
    order: CustomerOrderListRecord | CustomerOrderDetailRecord,
    carrier: ShippingCarrierPresentation | null,
  ) {
    const {
      shipment,
      payment,
      items: selectedItems,
      returnAuthorizedAt,
      shippingCarrierNameSnapshot,
      shippingCarrierTrackingUrlSnapshot,
      shippingPricingModeSnapshot,
      shippingDeliveryTypeSnapshot,
      shippingCarrierLogoSnapshot,
      ...summary
    } = order;
    const items = Array.isArray(selectedItems) ? selectedItems : [];
    const latestAttempt = payment?.attempts[0];
    const confirmedRefunds =
      'statusHistory' in order
        ? (order.payment?.refunds?.flatMap(({ id, amountToman, confirmedAt }) =>
            confirmedAt ? [{ id, amountToman, confirmedAt }] : [],
          ) ?? [])
        : [];
    const statusHistory = 'statusHistory' in order ? order.statusHistory : undefined;
    const cancellationReason = customerFacingCancellationReason(
      [...(statusHistory ?? [])].reverse().find((entry) => entry.toStatus === OrderStatus.CANCELLED)
        ?.reason,
    );

    return {
      ...summary,
      returnAuthorized: returnAuthorizedAt !== null,
      trackingCode: shipment?.trackingCode ?? null,
      shippingMethodName: shipment
        ? publicShippingMethodName(shipment, carrier)
        : (shippingCarrierNameSnapshot ?? null),
      shippingTrackingUrl: shipment
        ? shipment.carrierPresentationSnapshottedAt
          ? shipment.carrierTrackingUrlSnapshot
          : (carrier?.trackingUrl ?? null)
        : (shippingCarrierTrackingUrlSnapshot ?? null),
      shippingCarrierLogoUrl: shipment
        ? shipment.carrierPresentationSnapshottedAt
          ? shipment.carrierLogoSnapshot
            ? (this.publicMediaUrl?.resolve(shipment.carrierLogoSnapshot.storageKey) ?? null)
            : null
          : (carrier?.logoUrl ?? null)
        : shippingCarrierLogoSnapshot
          ? (this.publicMediaUrl?.resolve(shippingCarrierLogoSnapshot.storageKey) ?? null)
          : null,
      shippingPayOnDelivery: shippingPricingModeSnapshot === 'COLLECT',
      shippingDeliveryType: shipment?.deliveryTypeSnapshot ?? shippingDeliveryTypeSnapshot,
      payment: payment
        ? {
            status: payment.status,
            method: latestAttempt
              ? latestAttempt.provider === 'card_to_card'
                ? 'CARD_TO_CARD'
                : 'PAYMENT_GATEWAY'
              : null,
            receiptAvailable:
              latestAttempt?.provider === 'card_to_card' &&
              latestAttempt.receiptUploadedAt !== null,
            receiptOriginalName: latestAttempt?.receiptOriginalName ?? null,
            receiptUploadedAt: latestAttempt?.receiptUploadedAt ?? null,
            rejectionReason:
              payment.status === PaymentStatus.PENDING &&
              latestAttempt &&
              'failureCode' in latestAttempt &&
              latestAttempt.failureCode === 'CARD_TO_CARD_RECEIPT_REJECTED'
                ? (latestAttempt.failureMessage ?? null)
                : null,
          }
        : null,
      items: items.map(({ variant, returnAllocatedQuantity, ...item }) => {
        const product = variant?.product;
        const primaryMedia = product?.media[0];

        return {
          ...item,
          returnableQuantity: Math.max(0, item.quantity - returnAllocatedQuantity),
          productSlug: product?.slug ?? '',
          primaryMedia: primaryMedia
            ? {
                url: this.publicMediaUrl?.resolve(primaryMedia.media.storageKey) ?? null,
                mimeType: primaryMedia.media.mimeType,
                altText: primaryMedia.altText ?? primaryMedia.media.altText,
                width: primaryMedia.media.width,
                height: primaryMedia.media.height,
              }
            : null,
        };
      }),
      ...(statusHistory
        ? {
            cancellationReason,
            confirmedRefunds,
            statusHistory: statusHistory.map(({ reason: _reason, ...entry }) => entry),
          }
        : {}),
    };
  }

  async listOrders(query: ListOrdersQueryDto) {
    const orders: AdminOrderListRecord[] = await this.prisma.order.findMany({
      where: {
        status: query.status,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: ADMIN_ORDER_LIST_INCLUDE,
    });

    return orders.map((order) => ({
      ...order,
      items: order.items.map(({ variant, ...item }) => {
        const product = variant.product;
        const primaryMedia = product.media[0];

        return {
          ...item,
          productSlug: product.slug,
          primaryMedia: primaryMedia
            ? {
                url: this.publicMediaUrl?.resolve(primaryMedia.media.storageKey) ?? null,
                mimeType: primaryMedia.media.mimeType,
                altText: primaryMedia.altText ?? primaryMedia.media.altText,
                width: primaryMedia.media.width,
                height: primaryMedia.media.height,
              }
            : null,
        };
      }),
    }));
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
        throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
      }

      if (order.status === dto.status) {
        return attachHumanAuditEvent(order, {
          title: `وضعیت سفارش شماره ${order.orderNumber} بدون تغییر باقی ماند.`,
          operationType: 'STATUS_CHANGE',
          entityName: order.orderNumber,
          changes: [],
        });
      }

      const allowedNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
        [OrderStatus.PAID]: OrderStatus.PROCESSING,
        [OrderStatus.PROCESSING]: OrderStatus.SHIPPED,
        [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
      };

      if (allowedNextStatus[order.status] !== dto.status) {
        throw new DomainException(
          ErrorCode.ORDER_INVALID_STATUS_TRANSITION,
          'This order status transition is not allowed.',
        );
      }

      if (
        order.status === OrderStatus.PAID &&
        dto.status === OrderStatus.PROCESSING &&
        order.payment?.status !== PaymentStatus.PAID
      ) {
        throw new DomainException(
          ErrorCode.ORDER_PAYMENT_NOT_SETTLED,
          'Order payment is not settled.',
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
          throw new DomainException(
            ErrorCode.ORDER_SHIPMENT_NOT_READY,
            'Order shipment is not ready.',
          );
        }
      }

      if (
        dto.status === OrderStatus.DELIVERED &&
        order.shipment?.status !== ShipmentStatus.DELIVERED
      ) {
        throw new DomainException(
          ErrorCode.ORDER_SHIPMENT_NOT_READY,
          'Order shipment is not ready.',
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
        throw new DomainException(
          ErrorCode.ORDER_STATE_CHANGED,
          'Order state changed. Please retry.',
        );
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

      const notificationType: Partial<Record<OrderStatus, NotificationOutboxEventType>> = {
        [OrderStatus.PROCESSING]: NotificationOutboxEventType.ORDER_PROCESSING,
        [OrderStatus.SHIPPED]: NotificationOutboxEventType.ORDER_SHIPPED,
        [OrderStatus.DELIVERED]: NotificationOutboxEventType.ORDER_DELIVERED,
      };
      const selectedNotificationType = notificationType[dto.status];
      if (dto.sendCustomerSms !== false && selectedNotificationType) {
        await this.outbox?.enqueueOrderEvent(transaction, {
          type: selectedNotificationType,
          orderId,
          deduplicationKey: `order:${orderId}:${dto.status.toLowerCase()}`,
          payload: {},
        });
      }

      const statusNames: Partial<Record<OrderStatus, string>> = {
        [OrderStatus.PROCESSING]: 'آماده‌سازی',
        [OrderStatus.SHIPPED]: 'ارسال‌شده',
        [OrderStatus.DELIVERED]: 'تحویل‌شده',
      };
      return attachHumanAuditEvent(updated, {
        title: `سفارش شماره ${updated.orderNumber} به مرحله ${statusNames[updated.status] ?? updated.status} منتقل شد.`,
        operationType: 'STATUS_CHANGE',
        entityName: updated.orderNumber,
        changes: [
          {
            field: 'status',
            label: 'وضعیت سفارش',
            before: order.status,
            after: updated.status,
          },
        ],
      });
    });
  }

  async cancelOrder(orderId: string, dto: CancelOrderDto, actorUserId: string) {
    return this.cancelOrderReservation(orderId, dto, actorUserId);
  }

  async cancelMyOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    await this.cancelOrderReservation(orderId, dto, userId, userId);
    return this.getMyOrder(userId, orderId);
  }

  private async cancelOrderReservation(
    orderId: string,
    dto: CancelOrderDto,
    actorUserId: string,
    ownerUserId?: string,
  ) {
    const cancellationReason = ownerUserId
      ? 'لغو سفارش توسط مشتری'
      : dto.reason?.trim() || 'لغو سفارش توسط مدیریت';

    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          items: true,
          payment: {
            select: { status: true },
          },
        },
      });

      if (!order) {
        throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
      }

      if (ownerUserId && order.userId !== ownerUserId) {
        throw new DomainException(ErrorCode.ORDER_NOT_FOUND, 'Order was not found.');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new DomainException(
          ErrorCode.ORDER_CANNOT_CANCEL,
          'Order cannot be cancelled in current state.',
        );
      }

      if (order.payment?.status === PaymentStatus.AWAITING_REVIEW) {
        throw new DomainException(
          ErrorCode.ORDER_CANNOT_CANCEL,
          'Order cannot be cancelled while its payment receipt is under review.',
        );
      }

      const cancelledAt = new Date();
      const claimed = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT,
          ...(ownerUserId ? { userId: ownerUserId } : {}),
          OR: [
            { payment: { is: null } },
            { payment: { is: { status: { not: PaymentStatus.AWAITING_REVIEW } } } },
          ],
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (claimed.count !== 1) {
        throw new DomainException(
          ErrorCode.ORDER_STATE_CHANGED,
          'Order state changed. Please retry.',
        );
      }

      if (order.campaignQuotaRestricted) await releaseCampaignQuota(transaction, order.id);
      const quantitiesByVariant = await resolveVariantInventoryRequirements(
        transaction,
        order.items,
      );

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
          throw new DomainException(ErrorCode.INVENTORY_STATE_CHANGED, 'Inventory state changed.');
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
          throw new DomainException(ErrorCode.INVENTORY_STATE_CHANGED, 'Inventory state changed.');
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
            reason: cancellationReason,
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
          reason: cancellationReason,
        },
      });

      await this.outbox?.enqueueOrderEvent(transaction, {
        type: NotificationOutboxEventType.ORDER_CANCELLED,
        orderId: order.id,
        deduplicationKey: `order:${order.id}:cancelled`,
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
      salePriceToman: number | null;
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
    const effectiveSalePriceToman = variant.salePriceToman ?? variant.product.salePriceToman;
    if (effectiveSalePriceToman === null) {
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
      unitPlatingPriceToman = calculatePlatingPriceToman(platingWeightGrams, platingRateToman);
    }

    const unitSalePriceToman = effectiveSalePriceToman;
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
    const quantitiesByVariant = await resolveVariantInventoryRequirements(transaction, items, {
      requirePurchasableComponents: true,
    });

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
        throw new DomainException(ErrorCode.INVENTORY_NOT_AVAILABLE, 'Inventory is not available.');
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
        throw new DomainException(
          ErrorCode.INVENTORY_STATE_CHANGED,
          'Inventory state changed. Please retry.',
        );
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
