import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { planQuotaAllocations } from '../campaigns/campaign-quota';
import { attachHumanAuditEvent } from '../audit/audit-event';
import {
  calculatePromotion,
  isPromotionTarget,
  matchesPromotionAudience,
  type PromotionLine,
} from './promotion-engine';
import {
  committedCampaignIncentives,
  countedPromotionOrders,
  discountBudget,
  promotionUsage,
} from './promotion-budget';
import type {
  AdminPromotionDto,
  CampaignProductPricePreviewDto,
  PublicPromotionsDto,
  SavePromotionDto,
} from './dto/promotion.dto';
import { selectCatalogPromotion } from './promotion-presentation';

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
        if (discountBudget(campaign) <= 0)
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
        const { revision } = await tx.campaign.update({
          where: { id: campaignId },
          data: { revision: { increment: 1 } },
          select: { revision: true },
        });
        await tx.campaignRevision.create({
          data: {
            campaignId,
            version: revision,
            action: 'PROMOTION_EDIT',
            actorUserId,
            snapshot: {
              kind: updated.kind,
              value: updated.value,
              minSubtotalToman: updated.minSubtotalToman,
              maxDiscountToman: updated.maxDiscountToman,
              maxDiscountBps: updated.maxDiscountBps,
              priority: updated.priority,
              bundleProductIds: updated.bundleProductIds,
              hasCoupon: updated.couponCode !== null,
              maxUses: updated.maxUses,
              promotionVersion: updated.version,
            },
          },
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
    const available = await this.catalogPromotions(this.db, now);
    return {
      available: available.length > 0,
      items: available
        .filter(
          ({ couponCode, campaign }) =>
            couponCode === null && campaign.audience === 'ALL_CUSTOMERS',
        )
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

  async catalogPromotions(
    reader: Pick<Prisma.TransactionClient, 'campaignPromotion' | 'orderPriceQuote'>,
    now = new Date(),
    previewCampaignId?: string,
  ) {
    const candidates = await reader.campaignPromotion.findMany({
      where: { campaign: previewCampaignId ? { id: previewCampaignId } : this.activeCampaign(now) },
      orderBy: [{ priority: 'desc' }, { campaignId: 'asc' }],
      select: {
        couponCode: true,
        kind: true,
        value: true,
        minSubtotalToman: true,
        maxDiscountToman: true,
        maxDiscountBps: true,
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
            plannedChannelCostToman: true,
            audience: true,
            endsAt: true,
          },
        },
      },
    });
    const usage = candidates.length
      ? await reader.orderPriceQuote.groupBy({
          by: ['campaignId'],
          where: {
            campaignId: { in: candidates.map(({ campaignId }) => campaignId) },
            order: countedPromotionOrders,
          },
          _sum: {
            merchandiseDiscountToman: true,
            shippingDiscountToman: true,
            referralRewardToman: true,
          },
          _count: { _all: true },
        })
      : [];
    const usedByCampaign = new Map(usage.map((row) => [row.campaignId, row]));
    return candidates.flatMap((rule) => {
      const used = usedByCampaign.get(rule.campaignId);
      const committed = used ? committedCampaignIncentives(used) : 0;
      const remainingToman = discountBudget(rule.campaign) - committed;
      if (
        remainingToman <= 0 ||
        (rule.maxUses !== null && (used?._count._all ?? 0) >= rule.maxUses)
      )
        return [];
      return [{ ...rule, remainingToman }];
    });
  }

  async productPricePreview(
    campaignId: string,
    slug: string,
  ): Promise<CampaignProductPricePreviewDto> {
    return this.db.$transaction(
      async (tx) => {
        const [campaign, product] = await Promise.all([
          tx.campaign.findUnique({ where: { id: campaignId }, include: { promotion: true } }),
          tx.product.findFirst({
            where: { slug, deletedAt: null },
            select: {
              id: true,
              name: true,
              status: true,
              salePriceToman: true,
              categories: {
                where: { category: { isActive: true, deletedAt: null } },
                select: { categoryId: true },
              },
              variants: {
                where: { deletedAt: null },
                orderBy: { sku: 'asc' },
                select: { id: true, name: true, sku: true, salePriceToman: true, isActive: true },
              },
            },
          }),
        ]);
        if (!campaign || !product) throw new NotFoundException('Campaign or product not found.');
        const rule = campaign.promotion;
        const usage = rule ? await promotionUsage(tx, campaignId) : null;
        const remainingToman =
          discountBudget(campaign) - (usage ? committedCampaignIncentives(usage) : 0);
        const candidates =
          rule && (rule.maxUses === null || (usage?._count._all ?? 0) < rule.maxUses)
            ? [{ ...rule, campaign, remainingToman }]
            : [];
        const target = {
          productId: product.id,
          categoryIds: product.categories.map(({ categoryId }) => categoryId),
        };
        const row = (
          variantId: string | null,
          label: string,
          active: boolean,
          regularToman: number | null,
        ) => ({
          variantId,
          label,
          active,
          regularToman,
          offer: selectCatalogPromotion(candidates, target, regularToman),
        });
        return {
          name: product.name,
          prices: [
            row(null, 'قیمت پیش‌فرض', product.status === 'ACTIVE', product.salePriceToman),
            ...product.variants.map((variant) =>
              row(
                variant.id,
                variant.name ? `${variant.name} · ${variant.sku}` : variant.sku,
                product.status === 'ACTIVE' && variant.isActive,
                variant.salePriceToman ?? product.salePriceToman,
              ),
            ),
          ],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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
    let hasPaidOrder: boolean | undefined;
    for (const rule of candidates) {
      const eligible = lines.filter((line) => isPromotionTarget(rule.campaign, line));
      if (eligible.length === 0) continue;
      if (rule.campaign.audience !== 'ALL_CUSTOMERS' && userId && hasPaidOrder === undefined) {
        hasPaidOrder = Boolean(
          await tx.order.findFirst({
            where: { userId, paidAt: { not: null } },
            select: { id: true },
          }),
        );
      }
      if (!matchesPromotionAudience(rule.campaign.audience, hasPaidOrder)) continue;
      const usage = await promotionUsage(tx, rule.campaignId);
      if (rule.maxUses !== null && usage._count._all >= rule.maxUses) continue;
      if (
        (coupon || rule.campaign.audience === 'FIRST_PURCHASE') &&
        userId &&
        (await tx.orderPriceQuote.count({
          where: { campaignId: rule.campaignId, order: { ...countedPromotionOrders, userId } },
        }))
      )
        continue;

      const remaining = discountBudget(rule.campaign) - committedCampaignIncentives(usage);
      const amounts = calculatePromotion(rule, eligible, shippingToman, remaining);
      if (amounts) {
        const quotaAllocations = await planQuotaAllocations(
          tx,
          rule.campaignId,
          rule.kind === 'BUNDLE'
            ? eligible.filter(({ productId }) => rule.bundleProductIds.includes(productId))
            : eligible,
        );
        if (!quotaAllocations) continue;
        return {
          ...amounts,
          ...(quotaAllocations.length ? { quotaAllocations } : {}),
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
            ...(rule.campaign.plannedChannelCostToman === null
              ? {}
              : { plannedChannelCostToman: rule.campaign.plannedChannelCostToman }),
            ...(rule.campaign.audience === 'ALL_CUSTOMERS'
              ? {}
              : { audience: rule.campaign.audience }),
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
