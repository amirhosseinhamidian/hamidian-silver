import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { calculatePromotion, isPromotionTarget, type PromotionLine } from './promotion-engine';
import type { AdminPromotionDto, PublicPromotionsDto, SavePromotionDto } from './dto/promotion.dto';

const countedOrders = {
  OR: [{ status: { notIn: ['CANCELLED', 'EXPIRED'] } }, { paidAt: { not: null } }],
} satisfies Prisma.OrderWhereInput;

export function normalizeCoupon(value: string | undefined | null) {
  const coupon = value?.trim().toUpperCase() || null;
  if (coupon && !/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(coupon)) {
    throw new BadRequestException('Enter a valid coupon code.');
  }
  return coupon;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly db: PrismaService) {}

  async lockCampaign(tx: Prisma.TransactionClient, campaignId: string) {
    const [campaign] = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }

  async adminRule(campaignId: string): Promise<AdminPromotionDto> {
    const rule = await this.db.campaignPromotion.findUnique({ where: { campaignId } });
    if (!rule) return { rule: null };
    const bundleProducts = await this.db.product.findMany({
      where: { id: { in: rule.bundleProductIds } },
      select: { slug: true },
      orderBy: { slug: 'asc' },
    });
    return {
      rule: {
        kind: rule.kind,
        value: rule.value,
        minSubtotalToman: rule.minSubtotalToman,
        maxDiscountToman: rule.maxDiscountToman,
        maxDiscountBps: rule.maxDiscountBps,
        priority: rule.priority,
        bundleProductSlugs: bundleProducts.map(({ slug }) => slug),
        couponCode: rule.couponCode,
        maxUses: rule.maxUses,
        expectedVersion: rule.version,
      },
    };
  }

  async save(
    campaignId: string,
    input: SavePromotionDto,
    actorUserId: string,
  ): Promise<AdminPromotionDto> {
    const couponCode = normalizeCoupon(input.couponCode);
    const maxUses = input.maxUses ?? null;
    if (couponCode && maxUses === null)
      throw new BadRequestException('A coupon needs a redemption limit.');
    if (input.kind === 'FREE_SHIPPING' ? input.value !== 0 : input.value <= 0) {
      throw new BadRequestException('Enter a valid value for the promotion type.');
    }
    if (
      (input.kind === 'PERCENT' && input.value > 5_000) ||
      (input.kind === 'THRESHOLD' && input.minSubtotalToman <= 0)
    ) {
      throw new BadRequestException(
        'The percentage or purchase threshold is outside the allowed range.',
      );
    }
    if (
      input.kind === 'BUNDLE'
        ? input.bundleProductSlugs.length < 2
        : input.bundleProductSlugs.length > 0
    ) {
      throw new BadRequestException('A bundle needs at least two distinct products.');
    }

    try {
      return await this.db.$transaction(async (tx) => {
        await this.lockCampaign(tx, campaignId);
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { id: campaignId },
          include: { promotion: { select: { version: true } } },
        });
        if (campaign.status !== 'DRAFT')
          throw new ConflictException('Only draft promotions can be edited.');
        if ((campaign.promotion?.version ?? 0) !== input.expectedVersion) {
          throw new ConflictException('The promotion changed. Reload the campaign.');
        }
        if (campaign.budgetToman <= 0)
          throw new BadRequestException('Set a campaign budget before configuring a promotion.');

        const products = await tx.product.findMany({
          where: { slug: { in: input.bundleProductSlugs }, status: 'ACTIVE', deletedAt: null },
          select: {
            id: true,
            categories: {
              where: { category: { isActive: true, deletedAt: null } },
              select: { categoryId: true },
            },
          },
          orderBy: { id: 'asc' },
        });
        if (
          products.length !== input.bundleProductSlugs.length ||
          products.some(
            (product) =>
              !isPromotionTarget(campaign, {
                productId: product.id,
                categoryIds: product.categories.map(({ categoryId }) => categoryId),
              }),
          )
        ) {
          throw new BadRequestException('Choose active bundle products in the campaign scope.');
        }
        const data = {
          kind: input.kind,
          value: input.value,
          minSubtotalToman: input.minSubtotalToman,
          maxDiscountToman: input.maxDiscountToman,
          maxDiscountBps: input.maxDiscountBps,
          priority: input.priority,
          bundleProductIds: products.map(({ id }) => id),
          couponCode,
          maxUses,
          actorUserId,
        };
        const updated = await tx.campaignPromotion.upsert({
          where: { campaignId },
          create: { ...data, campaignId },
          update: { ...data, version: { increment: 1 } },
        });
        return attachHumanAuditEvent(
          {
            rule: { ...input, couponCode, maxUses, expectedVersion: updated.version },
          },
          {
            title: 'قانون تخفیف کمپین ذخیره شد.',
            entityName: campaign.name,
            operationType: campaign.promotion ? 'PRICE_CHANGE' : 'CREATE',
            changes: [
              {
                field: 'version',
                label: 'نسخهٔ قانون',
                before: campaign.promotion?.version ?? null,
                after: updated.version,
              },
            ],
          },
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This coupon is already in use.');
      }
      throw error;
    }
  }

  async publicPromotions(now = new Date()): Promise<PublicPromotionsDto> {
    const candidates = await this.db.campaignPromotion.findMany({
      where: { campaign: this.activeCampaign(now) },
      orderBy: [{ priority: 'desc' }, { campaignId: 'asc' }],
      select: {
        couponCode: true,
        kind: true,
        campaignId: true,
        maxUses: true,
        bundleProductIds: true,
        campaign: {
          select: {
            name: true,
            allProducts: true,
            productIds: true,
            categoryIds: true,
            budgetToman: true,
            endsAt: true,
          },
        },
      },
    });
    const usage = candidates.length
      ? await this.db.orderPriceQuote.groupBy({
          by: ['campaignId'],
          where: {
            campaignId: { in: candidates.map(({ campaignId }) => campaignId) },
            order: countedOrders,
          },
          _sum: { merchandiseDiscountToman: true, shippingDiscountToman: true },
          _count: { _all: true },
        })
      : [];
    const usedByCampaign = new Map(usage.map((row) => [row.campaignId, row]));
    const available = candidates.filter(({ campaign, campaignId, maxUses }) => {
      const used = usedByCampaign.get(campaignId);
      const committed =
        (used?._sum.merchandiseDiscountToman ?? 0) + (used?._sum.shippingDiscountToman ?? 0);
      return (
        committed < campaign.budgetToman && (maxUses === null || (used?._count._all ?? 0) < maxUses)
      );
    });
    return {
      available: available.length > 0,
      items: available
        .filter(({ couponCode }) => couponCode === null)
        .map(({ kind, campaign, bundleProductIds }) => ({
          name: campaign.name,
          kind,
          allProducts: kind !== 'BUNDLE' && campaign.allProducts,
          productIds: kind === 'BUNDLE' ? bundleProductIds : campaign.productIds,
          categoryIds: kind === 'BUNDLE' ? [] : campaign.categoryIds,
          endsAt: campaign.endsAt.toISOString(),
        })),
    };
  }

  async apply(
    tx: Prisma.TransactionClient,
    lines: readonly PromotionLine[],
    shippingToman: number,
    now: Date,
    coupon: string | null,
    userId?: string,
  ) {
    const candidates = await tx.campaignPromotion.findMany({
      where: { campaign: this.activeCampaign(now), couponCode: coupon },
      include: { campaign: true },
      orderBy: [{ priority: 'desc' }, { campaignId: 'asc' }],
    });
    for (const rule of candidates) {
      const eligible = lines.filter((line) => isPromotionTarget(rule.campaign, line));
      if (eligible.length === 0) continue;
      const where = { campaignId: rule.campaignId, order: countedOrders };
      const usage = await tx.orderPriceQuote.aggregate({
        where,
        _sum: { merchandiseDiscountToman: true, shippingDiscountToman: true },
        _count: { _all: true },
      });
      if (rule.maxUses !== null && usage._count._all >= rule.maxUses) continue;
      if (
        coupon &&
        userId &&
        (await tx.orderPriceQuote.count({
          where: { ...where, order: { ...countedOrders, userId } },
        }))
      )
        continue;

      const remaining =
        rule.campaign.budgetToman -
        (usage._sum.merchandiseDiscountToman ?? 0) -
        (usage._sum.shippingDiscountToman ?? 0);
      const amounts = calculatePromotion(rule, eligible, shippingToman, remaining);
      if (amounts) {
        return {
          ...amounts,
          campaignId: rule.campaignId,
          campaignName: rule.campaign.name,
          rule: {
            version: rule.version,
            campaignRevision: rule.campaign.revision,
            kind: rule.kind,
            value: rule.value,
            minSubtotalToman: rule.minSubtotalToman,
            maxDiscountToman: rule.maxDiscountToman,
            maxDiscountBps: rule.maxDiscountBps,
            priority: rule.priority,
            bundleProductIds: rule.bundleProductIds,
            budgetToman: rule.campaign.budgetToman,
            maxUses: rule.maxUses,
            coupon: rule.couponCode !== null,
            eligibleProductIds: [...new Set(eligible.map(({ productId }) => productId))].sort(),
          },
        };
      }
    }
    return null;
  }

  private activeCampaign(now: Date): Prisma.CampaignWhereInput {
    return {
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gt: now },
      budgetToman: { gt: 0 },
    };
  }
}
