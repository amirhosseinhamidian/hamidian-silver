import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { GrowthCampaignCost, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type {
  GrowthCostDto,
  GrowthCostsDto,
  GrowthDashboardDto,
  GrowthDashboardMetricsDto,
  GrowthDashboardQueryDto,
  RecordGrowthCostDto,
} from './dto/growth-dashboard.dto';
import { growthDashboardQuery } from './growth-dashboard-query';
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
    const period = growthRevenuePeriod(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [summary, ...groups] = await this.prisma.$queryRaw<DashboardRow[]>(
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
