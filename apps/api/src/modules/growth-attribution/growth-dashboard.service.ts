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
import { committedDiscount, promotionUsage } from '../promotions/promotion-budget';
import type {
  GrowthCampaignHistoryItemDto,
  GrowthCampaignPerformanceDto,
  GrowthCampaignPerformanceQueryDto,
} from './dto/growth-campaign-performance.dto';
import type {
  GrowthCostDto,
  GrowthCostsDto,
  GrowthDashboardDto,
  GrowthDashboardMetricsDto,
  GrowthDashboardQueryDto,
  RecordGrowthCostDto,
} from './dto/growth-dashboard.dto';
import { growthDashboardQuery } from './growth-dashboard-query';
import {
  growthCampaignHistoryQuery,
  growthCampaignPerformanceQuery,
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
    >
  ]: bigint;
} & {
  isTotal: boolean;
  total: bigint;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  campaignId: string | null;
  ordersWithRecordedSpend: bigint;
  recordedSpendToman: bigint | null;
};

type CampaignPerformanceRow = {
  newCustomers: bigint;
  merchandiseDiscountToman: bigint;
  shippingDiscountToman: bigint;
  lifetimeMediaSpendToman: bigint | null;
};

type CampaignHistoryRow = Omit<GrowthCampaignHistoryItemDto, 'occurredAt'> & {
  occurredAt: Date;
};

const campaignHistoryPageSize = 25;

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
    submittedOrders,
    confirmedOrders,
    confirmedSubmissions,
    collectedToman,
    refundedToman: exactNumber(row.refundedToman),
    netCollectedToman: exactNumber(row.collectedToman - row.refundedToman),
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
    const [summary, ...groups] = await db.$queryRaw<DashboardRow[]>(
      growthDashboardQuery(query, page, limit),
    );
    return {
      period,
      totals: metrics(summary),
      items: groups.map((row) => ({
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
    return this.prisma.$transaction(
      async (db) => {
        const identity = await db.campaignLinkIdentity.findUnique({
          where: { id: campaignId },
          select: {
            campaign: true,
            lifecycle: {
              select: { id: true, name: true, budgetToman: true, plannedChannelCostToman: true },
            },
          },
        });
        if (!identity) throw new NotFoundException('Campaign link identity not found.');
        const campaign = identity.lifecycle;
        const [{ totals }, [stats], history] = await Promise.all([
          this.readDashboard(db, { ...period, campaignId, limit: 1 }),
          db.$queryRaw<CampaignPerformanceRow[]>(
            growthCampaignPerformanceQuery(query, campaignId, campaign?.id ?? null),
          ),
          db.$queryRaw<CampaignHistoryRow[]>(
            growthCampaignHistoryQuery(query, campaignId, page, campaignHistoryPageSize),
          ),
        ]);
        const newCustomers = exactNumber(stats.newCustomers);
        const spend = totals.recordedSpendToman;
        const comparableSpend =
          spend !== null && spend > 0 && totals.recordedSpendPerConfirmedOrderToman !== null
            ? spend
            : null;
        const budget = campaign
          ? await this.campaignBudget(db, campaign, stats.lifetimeMediaSpendToman)
          : null;
        return {
          campaignId,
          campaign: campaign?.name ?? identity.campaign,
          period,
          totals,
          newCustomers,
          cacToman:
            comparableSpend !== null && newCustomers > 0
              ? Math.round(comparableSpend / newCustomers)
              : null,
          roas: comparableSpend === null ? null : totals.netCollectedToman / comparableSpend,
          merchandiseDiscountToman: campaign ? exactNumber(stats.merchandiseDiscountToman) : null,
          shippingDiscountToman: campaign ? exactNumber(stats.shippingDiscountToman) : null,
          consumedCreditToman: null,
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
      { isolationLevel: 'RepeatableRead' },
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
    const lifetimeMediaSpendToman = mediaSpend === null ? null : exactNumber(mediaSpend);
    const comparableSpend = mediaSpend !== null && mediaSpend >= 0n ? mediaSpend : null;
    return {
      budgetToman: campaign.budgetToman,
      plannedChannelCostToman: campaign.plannedChannelCostToman,
      lifetimeMediaSpendToman,
      lifetimeCommittedDiscountToman,
      unpaidDiscountCommitmentToman: committedDiscount(unpaid),
      mediaVarianceToman:
        comparableSpend === null || campaign.plannedChannelCostToman === null
          ? null
          : exactNumber(comparableSpend - BigInt(campaign.plannedChannelCostToman)),
      budgetVarianceToman:
        comparableSpend === null
          ? null
          : exactNumber(
              comparableSpend +
                BigInt(lifetimeCommittedDiscountToman) -
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
