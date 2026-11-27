import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { GrowthCampaignCost, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { campaignQuotaTotals } from '../campaigns/campaign-quota';
import {
  committedCampaignIncentives,
  committedDiscount,
  discountBudget,
  promotionUsage,
} from '../promotions/promotion-budget';
import type {
  GrowthCampaignHistoryItemDto,
  GrowthCampaignPerformanceDto,
  GrowthCampaignPerformanceQueryDto,
  GrowthCampaignTrackingContentDto,
} from './dto/growth-campaign-performance.dto';
import type {
  GrowthCostDto,
  GrowthCostsDto,
  GrowthDashboardDayDto,
  GrowthDashboardDto,
  GrowthDashboardMetricsDto,
  GrowthDashboardQueryDto,
  GrowthDashboardVisitStagesDto,
  RecordGrowthCostDto,
} from './dto/growth-dashboard.dto';
import { growthDashboardQuery, minimumChannelOrders } from './growth-dashboard-query';
import {
  growthCampaignHistoryQuery,
  growthCampaignPerformanceQuery,
  growthCampaignTrackingQuery,
} from './growth-campaign-performance-query';
import { growthRevenuePeriod } from './growth-revenue.service';

type DashboardRow = {
  [
    Key in Exclude<
      keyof GrowthDashboardMetricsDto,
      | 'netCollectedToman'
      | 'conversionPercent'
      | 'averageOrderToman'
      | 'recordedSpendPerConfirmedOrderToman'
      | 'recordedSpendToman'
      | 'walletAppliedToman'
    >
  ]: bigint;
} & {
  isTotal: boolean;
  day: string | null;
  total: bigint;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  campaignId: string | null;
  ordersWithRecordedSpend: bigint;
  recordedSpendToman: bigint | null;
  walletAppliedToman: bigint | null;
  leaderId: string | null;
  leaderLabel: string | null;
  leaderPurchases: bigint | null;
  leaderMedium: string | null;
  leaderSubmitted: bigint | null;
  leaderConfirmed: bigint | null;
} & Record<keyof GrowthDashboardVisitStagesDto, bigint>;

type CampaignPerformanceRow = {
  hasOfferHistory: boolean;
  submittedOrders: bigint;
  confirmedOrders: bigint;
  confirmedSubmissions: bigint;
  collectedToman: bigint;
  refundedToman: bigint;
  merchandiseDiscountToman: bigint;
  shippingDiscountToman: bigint;
  lifetimeMediaSpendToman: bigint | null;
};

type CampaignTrackingRow = Omit<
  GrowthCampaignTrackingContentDto,
  'submittedOrders' | 'confirmedOrders' | 'netCollectedToman'
> & { submittedOrders: bigint; confirmedOrders: bigint; netCollectedToman: bigint };

type CampaignHistoryRow = Omit<GrowthCampaignHistoryItemDto, 'occurredAt'> & {
  occurredAt: Date;
};

const campaignHistoryPageSize = 25;
const campaignBreakdownLimit = 8;

function campaignSpendCoverage(
  totals: GrowthDashboardMetricsDto,
): GrowthCampaignPerformanceDto['spendCoverage'] {
  if (totals.recordedSpendToman === null) return 'NO_COST';
  if (totals.recordedSpendToman <= 0) return 'NON_POSITIVE_COST';
  if (totals.confirmedOrders === 0) return 'NO_CONFIRMED_ORDERS';
  return totals.recordedSpendPerConfirmedOrderToman === null ? 'INCOMPLETE_COST' : 'MATCHED';
}

function exactNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new ServiceUnavailableException('Growth figures exceed the supported reporting range.');
  }
  return number;
}

function metrics(row: DashboardRow): GrowthDashboardMetricsDto {
  const measuredVisits = row.measuredVisits === 0n ? null : exactNumber(row.measuredVisits);
  const confirmedOrders = exactNumber(row.confirmedOrders);
  const submittedOrders = exactNumber(row.submittedOrders);
  const confirmedSubmissions = exactNumber(row.confirmedSubmissions);
  const collectedToman = exactNumber(row.collectedToman);
  const recordedSpendToman =
    row.recordedSpendToman === null ? null : exactNumber(row.recordedSpendToman);
  return {
    confirmedCustomers: exactNumber(row.confirmedCustomers),
    newCustomers: exactNumber(row.newCustomers),
    returningCustomers: exactNumber(row.returningCustomers),
    submittedOrders,
    confirmedOrders,
    campaignAttributedOrders: exactNumber(row.campaignAttributedOrders),
    confirmedSubmissions,
    collectedToman,
    refundedToman: exactNumber(row.refundedToman),
    netCollectedToman: exactNumber(row.collectedToman - row.refundedToman),
    orderDiscountToman: exactNumber(row.orderDiscountToman),
    walletAppliedToman:
      row.walletAppliedToman === null ? null : exactNumber(row.walletAppliedToman),
    conversionPercent: submittedOrders ? (confirmedSubmissions / submittedOrders) * 100 : null,
    averageOrderToman: confirmedOrders ? Math.round(collectedToman / confirmedOrders) : null,
    recordedSpendToman,
    recordedSpendPerConfirmedOrderToman:
      recordedSpendToman !== null &&
      recordedSpendToman >= 0 &&
      confirmedOrders &&
      row.ordersWithRecordedSpend === row.confirmedOrders
        ? Math.round(recordedSpendToman / confirmedOrders)
        : null,
    measuredVisits,
    itemListViews: measuredVisits === null ? null : exactNumber(row.itemListViews),
    itemSelections: measuredVisits === null ? null : exactNumber(row.itemSelections),
    itemViews: measuredVisits === null ? null : exactNumber(row.itemViews),
    cartAdds: measuredVisits === null ? null : exactNumber(row.cartAdds),
    checkouts: measuredVisits === null ? null : exactNumber(row.checkouts),
  };
}

function dashboardDays(
  period: GrowthDashboardDto['period'],
  rows: DashboardRow[],
): GrowthDashboardDayDto[] {
  const byDay = new Map(rows.filter(({ day }) => day !== null).map((row) => [row.day, row]));
  const days: GrowthDashboardDayDto[] = [];
  const end = Date.parse(`${period.to}T00:00:00Z`);
  for (let time = Date.parse(`${period.from}T00:00:00Z`); time <= end; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    const row = byDay.get(day);
    days.push({
      day,
      confirmedOrders: exactNumber(row?.confirmedOrders ?? 0n),
      campaignAttributedOrders: exactNumber(row?.campaignAttributedOrders ?? 0n),
      collectedToman: exactNumber(row?.collectedToman ?? 0n),
      netCollectedToman: exactNumber((row?.collectedToman ?? 0n) - (row?.refundedToman ?? 0n)),
      newCustomers: exactNumber(row?.newCustomers ?? 0n),
      orderDiscountToman: exactNumber(row?.orderDiscountToman ?? 0n),
      walletAppliedToman:
        row?.walletAppliedToman === null ? null : exactNumber(row?.walletAppliedToman ?? 0n),
    });
  }
  return days;
}

function costDto(cost: GrowthCampaignCost & { campaign: { campaign: string } }): GrowthCostDto {
  return {
    id: cost.id,
    campaignId: cost.campaignId,
    campaign: cost.campaign.campaign,
    source: cost.source,
    medium: cost.medium,
    day: cost.day.toISOString().slice(0, 10),
    amountToman: cost.amountToman,
    note: cost.note,
    recordedAt: cost.recordedAt.toISOString(),
  };
}

@Injectable()
export class GrowthDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async read(query: GrowthDashboardQueryDto): Promise<GrowthDashboardDto> {
    return this.readDashboard(this.prisma, query);
  }

  private async readDashboard(
    db: Prisma.TransactionClient,
    query: GrowthDashboardQueryDto,
  ): Promise<GrowthDashboardDto> {
    const period = growthRevenuePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [summary, ...rows] = await db.$queryRaw<DashboardRow[]>(
      growthDashboardQuery(query, page, limit),
    );
    return {
      period,
      generatedAt: new Date().toISOString(),
      totals: metrics(summary),
      daily: dashboardDays(period, rows),
      visitStages:
        summary.measuredVisits === 0n
          ? null
          : {
              itemList: exactNumber(summary.itemList),
              item: exactNumber(summary.item),
              cart: exactNumber(summary.cart),
              checkout: exactNumber(summary.checkout),
            },
      leadingCampaign:
        summary.leaderId !== null && summary.leaderPurchases !== null
          ? {
              campaignId: summary.leaderId,
              campaign: summary.leaderLabel ?? summary.leaderId,
              confirmedOrders: exactNumber(summary.leaderPurchases),
            }
          : null,
      leadingChannel:
        summary.leaderMedium !== null &&
        summary.leaderSubmitted !== null &&
        summary.leaderConfirmed !== null
          ? {
              medium: summary.leaderMedium,
              submittedOrders: exactNumber(summary.leaderSubmitted),
              confirmedSubmissions: exactNumber(summary.leaderConfirmed),
            }
          : null,
      minimumChannelOrders,
      items: rows
        .filter(({ day }) => day === null)
        .map((row) => ({
          source: row.source,
          medium: row.medium,
          campaign: row.campaign,
          campaignId: row.campaignId,
          ...metrics(row),
        })),
      page,
      limit,
      total: exactNumber(summary.total),
    };
  }

  async campaignPerformance(
    campaignId: string,
    query: GrowthCampaignPerformanceQueryDto,
  ): Promise<GrowthCampaignPerformanceDto> {
    const period = growthRevenuePeriod(query);
    const page = query.page ?? 1;
    const contentPage = query.contentPage ?? 1;
    return this.prisma.$transaction(
      async (db) => {
        const identity = await db.campaignLinkIdentity.findUnique({
          where: { id: campaignId },
          select: {
            campaign: true,
            lifecycle: {
              select: {
                id: true,
                name: true,
                kind: true,
                managementPurpose: true,
                budgetToman: true,
                plannedChannelCostToman: true,
              },
            },
          },
        });
        if (!identity) throw new NotFoundException('Campaign link identity not found.');
        const campaign = identity.lifecycle;
        const [{ totals, items, total, generatedAt }, [stats], history, content, quota] =
          await Promise.all([
            this.readDashboard(db, { ...period, campaignId, limit: campaignBreakdownLimit }),
            db.$queryRaw<CampaignPerformanceRow[]>(
              growthCampaignPerformanceQuery(query, campaignId, campaign?.id ?? null),
            ),
            db.$queryRaw<CampaignHistoryRow[]>(
              growthCampaignHistoryQuery(query, campaignId, page, campaignHistoryPageSize),
            ),
            db.$queryRaw<CampaignTrackingRow[]>(
              growthCampaignTrackingQuery(query, campaignId, contentPage, campaignBreakdownLimit),
            ),
            campaign ? campaignQuotaTotals(db, campaign.id) : null,
          ]);
        const newCustomers = totals.newCustomers;
        const spendCoverage = campaignSpendCoverage(totals);
        const comparableSpend = spendCoverage === 'MATCHED' ? totals.recordedSpendToman : null;
        const budget = campaign
          ? await this.campaignBudget(db, campaign, stats.lifetimeMediaSpendToman)
          : null;
        const hasOffer =
          campaign &&
          (campaign.kind !== 'MARKETING' || stats.hasOfferHistory || Boolean(quota?.products));
        const submittedOrders = exactNumber(stats.submittedOrders);
        return {
          campaignId,
          campaign: campaign?.name ?? identity.campaign,
          managedCampaignId: campaign?.id ?? null,
          campaignType: campaign?.managementPurpose ?? campaign?.kind ?? 'TRACKING_ONLY',
          period,
          generatedAt,
          totals,
          spendCoverage,
          offer:
            quota && hasOffer
              ? {
                  submittedOrders,
                  confirmedOrders: exactNumber(stats.confirmedOrders),
                  collectedToman: exactNumber(stats.collectedToman),
                  refundedToman: exactNumber(stats.refundedToman),
                  netCollectedToman: exactNumber(stats.collectedToman - stats.refundedToman),
                  conversionPercent: submittedOrders
                    ? (exactNumber(stats.confirmedSubmissions) / submittedOrders) * 100
                    : null,
                  quota,
                }
              : null,
          channels: items,
          channelCount: total,
          contentPage,
          trackingContents: content.slice(0, campaignBreakdownLimit).map((row) => ({
            ...row,
            submittedOrders: exactNumber(row.submittedOrders),
            confirmedOrders: exactNumber(row.confirmedOrders),
            netCollectedToman: exactNumber(row.netCollectedToman),
          })),
          hasMoreTrackingContents: content.length > campaignBreakdownLimit,
          newCustomers,
          cacToman:
            comparableSpend !== null && newCustomers > 0
              ? Math.round(comparableSpend / newCustomers)
              : null,
          roas: comparableSpend === null ? null : totals.netCollectedToman / comparableSpend,
          merchandiseDiscountToman: campaign ? exactNumber(stats.merchandiseDiscountToman) : null,
          shippingDiscountToman: campaign ? exactNumber(stats.shippingDiscountToman) : null,
          consumedCreditToman: totals.walletAppliedToman,
          issuedRewardToman: null,
          outstandingRewardCommitmentToman: null,
          budget,
          history: history.slice(0, campaignHistoryPageSize).map((item) => ({
            ...item,
            occurredAt: item.occurredAt.toISOString(),
          })),
          page,
          hasMoreHistory: history.length > campaignHistoryPageSize,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10_000 },
    );
  }

  private async campaignBudget(
    db: Prisma.TransactionClient,
    campaign: { id: string; budgetToman: number; plannedChannelCostToman: number | null },
    mediaSpend: bigint | null,
  ) {
    const [committed, unpaid] = await Promise.all([
      promotionUsage(db, campaign.id),
      promotionUsage(db, campaign.id, { paidAt: null }),
    ]);
    const lifetimeCommittedDiscountToman = committedDiscount(committed);
    const lifetimeCommittedReferralRewardToman = committed._sum.referralRewardToman ?? 0;
    const lifetimeMediaSpendToman = mediaSpend === null ? null : exactNumber(mediaSpend);
    const comparableSpend = mediaSpend !== null && mediaSpend >= 0n ? mediaSpend : null;
    return {
      budgetToman: campaign.budgetToman,
      plannedChannelCostToman: campaign.plannedChannelCostToman,
      lifetimeMediaSpendToman,
      lifetimeCommittedDiscountToman,
      ...(lifetimeCommittedReferralRewardToman ? { lifetimeCommittedReferralRewardToman } : {}),
      unpaidDiscountCommitmentToman: committedDiscount(unpaid),
      remainingDiscountToman: Math.max(
        0,
        discountBudget(campaign) - committedCampaignIncentives(committed),
      ),
      mediaVarianceToman:
        comparableSpend === null || campaign.plannedChannelCostToman === null
          ? null
          : exactNumber(comparableSpend - BigInt(campaign.plannedChannelCostToman)),
      budgetVarianceToman:
        comparableSpend === null
          ? null
          : exactNumber(
              comparableSpend +
                BigInt(committedCampaignIncentives(committed)) -
                BigInt(campaign.budgetToman),
            ),
    };
  }

  async costs(query: GrowthDashboardQueryDto): Promise<GrowthCostsDto> {
    growthRevenuePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.GrowthCampaignCostWhereInput = {
      day: { gte: new Date(query.from), lte: new Date(query.to) },
      source: query.source,
      medium: query.medium,
      campaignId: query.campaignId,
    };
    return this.prisma.$transaction(
      async (db) => {
        const total = await db.growthCampaignCost.count({ where });
        const rows = await db.growthCampaignCost.findMany({
          where,
          include: { campaign: { select: { campaign: true } } },
          orderBy: [{ day: 'desc' }, { recordedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        });
        return { items: rows.map(costDto), page, limit, total };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async recordCost(input: RecordGrowthCostDto): Promise<GrowthCostDto> {
    growthRevenuePeriod({ from: input.day, to: input.day });
    const day = new Date(input.day);
    const note = input.note?.trim() || null;
    const { id, campaignId, source, medium, amountToman } = input;
    return this.prisma.$transaction(async (db) => {
      const campaign = await db.campaignLinkIdentity.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new BadRequestException('Use an existing campaign link identity.');
      const inserted = await db.growthCampaignCost.createMany({
        data: { id, campaignId, source, medium, amountToman, day, note },
        skipDuplicates: true,
      });
      const row = await db.growthCampaignCost.findUniqueOrThrow({
        where: { id },
        include: { campaign: { select: { campaign: true } } },
      });
      if (
        row.campaignId !== campaignId ||
        row.source !== source ||
        row.medium !== medium ||
        row.amountToman !== amountToman ||
        +row.day !== +day ||
        row.note !== note
      ) {
        throw new ConflictException('The cost reference was already used with different values.');
      }
      return attachHumanAuditEvent(costDto(row), {
        title: inserted.count ? 'ثبت هزینهٔ کمپین' : 'دریافت دوبارهٔ هزینهٔ ثبت‌شدهٔ کمپین',
        entityName: campaign.campaign,
        operationType: 'CREATE',
        changes: inserted.count
          ? [{ field: 'amountToman', label: 'هزینهٔ ثبت‌شده', before: null, after: amountToman }]
          : [],
      });
    });
  }
}
