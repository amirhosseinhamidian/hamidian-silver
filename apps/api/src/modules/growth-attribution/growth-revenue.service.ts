import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  type GrowthRevenueEventDto,
  type GrowthRevenueEventsDto,
  type GrowthRevenueEventsQueryDto,
  type GrowthRevenuePeriodDto,
  type GrowthRevenueQueryDto,
  type GrowthRevenueSummaryDto,
  RevenueEventKind as Kind,
} from './dto/growth-revenue.dto';
import { growthRevenueEvents } from './growth-revenue-events';

type SummaryCounters = Omit<
  GrowthRevenueSummaryDto,
  | 'period'
  | 'currency'
  | 'netCollectedToman'
  | 'paymentChannelFeeToman'
  | 'shippingProviderCostToman'
  | 'campaignDiscountToman'
  | 'walletAppliedToman'
  | 'marketingChannelCostToman'
>;
type SummaryRow = Record<keyof SummaryCounters, bigint> & {
  paymentChannelFeeToman: bigint | null;
  shippingProviderCostToman: bigint | null;
};

export function growthRevenuePeriod({ from, to }: GrowthRevenueQueryDto): GrowthRevenuePeriodDto {
  const dateShape = /^[1-9]\d{3}-\d{2}-\d{2}$/;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const durationDays = (end.valueOf() - start.valueOf()) / 86_400_000;
  if (
    !dateShape.test(from) ||
    !dateShape.test(to) ||
    !Number.isFinite(durationDays) ||
    start.toISOString().slice(0, 10) !== from ||
    end.toISOString().slice(0, 10) !== to ||
    durationDays < 0 ||
    durationDays >= 92
  ) {
    throw new BadRequestException('Select a valid report period of at most 92 calendar days.');
  }
  return { from, to, timezone: 'Asia/Tehran' };
}

@Injectable()
export class GrowthRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: GrowthRevenueQueryDto): Promise<GrowthRevenueSummaryDto> {
    const period = growthRevenuePeriod(query);
    const [row] = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      ${growthRevenueEvents(query)}
      SELECT
        COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_SUBMITTED}) AS "submittedOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "paidOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED} AND source IS NOT NULL) AS "attributedPaidOrderCount",
        COUNT(*) FILTER (WHERE "missingFinanceSnapshot") AS "paidOrderWithoutFinanceSnapshotCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_DELIVERED}) AS "deliveredPaidOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.CANCELLATION}) AS "cancelledOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_EXPIRED}) AS "expiredOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.RECEIPT_SUBMITTED}) AS "receiptSubmittedCount",
        COUNT(DISTINCT "orderId") FILTER (WHERE "awaitingReview") AS "awaitingReceiptReviewOrderCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.RECEIPT_REJECTED}) AS "receiptRejectedCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.RECONCILIATION_REQUIRED}) AS "paymentReconciliationCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.RETURN_RECEIVED}) AS "receivedReturnCount",
        COUNT(*) FILTER (WHERE kind = ${Kind.REFUND_ADJUSTMENT}) AS "confirmedRefundCount",
        COALESCE(SUM("merchandiseToman"), 0) AS "merchandiseToman",
        COALESCE(SUM("platingToman"), 0) AS "platingToman",
        COALESCE(SUM("orderDiscountToman"), 0) AS "orderDiscountToman",
        COALESCE(SUM("shippingChargedToman"), 0) AS "shippingChargedToman",
        COALESCE(SUM("taxToman"), 0) AS "taxToman",
        COALESCE(SUM("amountToman") FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}), 0) AS "collectedToman",
        COALESCE(SUM("amountToman") FILTER (WHERE kind = ${Kind.REFUND_ADJUSTMENT}), 0) AS "refundedToman",
        SUM("amountToman") FILTER (WHERE kind = ${Kind.PAYMENT_CHANNEL_FEE}) AS "paymentChannelFeeToman",
        SUM("amountToman") FILTER (WHERE kind = ${Kind.SHIPPING_PROVIDER_COST}) AS "shippingProviderCostToman"
      FROM attributed
    `);
    const { paymentChannelFeeToman, shippingProviderCostToman, ...counts } = row;
    const totals = Object.fromEntries(
      Object.entries(counts).map(([key, value]) => [key, Number(value)]),
    ) as SummaryCounters;
    return {
      period,
      currency: 'TOMAN',
      ...totals,
      netCollectedToman: totals.collectedToman - totals.refundedToman,
      paymentChannelFeeToman:
        paymentChannelFeeToman === null ? null : Number(paymentChannelFeeToman),
      shippingProviderCostToman:
        shippingProviderCostToman === null ? null : Number(shippingProviderCostToman),
      campaignDiscountToman: null,
      walletAppliedToman: null,
      marketingChannelCostToman: null,
    };
  }

  async events(query: GrowthRevenueEventsQueryDto): Promise<GrowthRevenueEventsDto> {
    const period = growthRevenuePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const kindFilter =
      query.kind === undefined ? Prisma.empty : Prisma.sql`WHERE kind = ${query.kind}`;
    const [row] = await this.prisma.$queryRaw<
      { total: bigint; items: GrowthRevenueEventDto[] }[]
    >(Prisma.sql`
      ${growthRevenueEvents(query)}, selected AS (
        SELECT "eventId", "orderId", kind, "occurredAt", "amountToman", provider, source, medium, campaign, "campaignId"
        FROM attributed
        ${kindFilter}
      ), page_items AS (
        SELECT * FROM selected ORDER BY "occurredAt" DESC, "eventId" DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      )
      SELECT
        (SELECT COUNT(*) FROM selected) AS total,
        COALESCE(jsonb_agg(page_items ORDER BY "occurredAt" DESC, "eventId" DESC), '[]'::jsonb) AS items
      FROM page_items
    `);
    return { period, items: row.items, page, limit, total: Number(row.total) };
  }
}
