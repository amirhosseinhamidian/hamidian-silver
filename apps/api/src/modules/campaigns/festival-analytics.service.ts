import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { growthRevenuePeriod } from '../growth-attribution/growth-revenue.service';
import { CampaignOperationsCenterService } from './campaign-operations-center.service';
import { campaignBudget } from './campaign-operations';
import type { FestivalAnalyticsDto, FestivalAnalyticsQueryDto } from './dto/festival-analytics.dto';
import { festivalAnalyticsQuery } from './festival-analytics-query';

const pageSize = 25;
type SalesRow = Pick<
  FestivalAnalyticsDto,
  'daily' | 'topProducts' | 'topCategories' | 'topSources' | 'states' | 'groups' | 'funnel'
> & {
  orderItems: FestivalAnalyticsDto['orders'];
  orders: bigint;
  confirmedOrders: bigint;
  units: bigint;
  collectedToman: bigint;
  discountToman: bigint;
  startedOrders: bigint;
  confirmedStarts: bigint;
};

function exactNumber(value: bigint | number) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new ServiceUnavailableException('Festival sales exceed the supported reporting range.');
  }
  return result;
}

@Injectable()
export class FestivalAnalyticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly operations: CampaignOperationsCenterService,
  ) {}

  async read(id: string, query: FestivalAnalyticsQueryDto): Promise<FestivalAnalyticsDto> {
    const period = growthRevenuePeriod(query);
    if ([query.product, query.category].some((slug) => slug?.includes('\0'))) {
      throw new BadRequestException('Select a valid product or category.');
    }
    const page = query.page ?? 1;
    return this.db.$transaction(
      async (tx) => {
        const checkedAt = new Date().toISOString();
        const campaign = await tx.campaign.findFirst({
          where: { id, kind: 'FESTIVAL' },
          include: { promotion: true },
        });
        if (!campaign) throw new NotFoundException('Festival not found.');

        const [sales] = await tx.$queryRaw<SalesRow[]>(
          festivalAnalyticsQuery(campaign, query, page, pageSize),
        );
        const budget = await campaignBudget(tx, campaign, campaign.promotion);
        const { quota, quotaItems, hasMoreQuotas } = await this.operations.readQuotas(
          tx,
          id,
          query.section === 'quotas' ? page : undefined,
        );
        const {
          orderItems,
          orders,
          confirmedOrders,
          units,
          collectedToman,
          discountToman,
          startedOrders,
          confirmedStarts,
          groups,
          ...charts
        } = sales;
        const count = exactNumber(confirmedOrders);
        const collected = exactNumber(collectedToman);
        const submitted = exactNumber(startedOrders);
        return {
          campaignId: id,
          name: campaign.name,
          checkedAt,
          period,
          totals: {
            orders: exactNumber(orders),
            confirmedOrders: count,
            units: exactNumber(units),
            collectedToman: collected,
            discountToman: exactNumber(discountToman),
            averageOrderToman: count ? Math.round(collected / count) : null,
            orderConfirmationPercent:
              !query.orderState && submitted
                ? (exactNumber(confirmedStarts) / submitted) * 100
                : null,
          },
          ...charts,
          budget,
          quota,
          groups: groups.slice(0, pageSize),
          orders: orderItems.slice(0, pageSize),
          quotaItems,
          page,
          hasMore:
            page < 1000 &&
            (hasMoreQuotas || groups.length > pageSize || orderItems.length > pageSize),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 },
    );
  }
}
