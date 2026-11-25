import { ConflictException } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { CampaignQuota, Prisma } from '../../generated/prisma/client';
import {
  availabilitySelect,
  productAvailableQuantity,
  variantAvailableQuantity,
} from '../catalog/catalog-public-availability';
import { isPromotionTarget } from '../promotions/promotion-engine';
import type { PublicCampaignQuotaDto } from './dto/campaign-quota.dto';

export type QuotaReader = Pick<
  Prisma.TransactionClient,
  'campaignQuota' | 'campaignQuotaAllocation' | 'product'
>;
type QuotaAllocation = { quotaId: string; quantity: number };

function activeQuotaCampaign(now: Date) {
  return { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } } as const;
}

export async function quotaUsage(reader: QuotaReader, ids: string[]) {
  const rows = ids.length
    ? await reader.campaignQuotaAllocation.groupBy({
        by: ['quotaId', 'state'],
        where: { quotaId: { in: ids }, state: { in: ['RESERVED', 'CAPTURED'] } },
        _sum: { quantity: true },
      })
    : [];
  const usage = new Map<string, { siteSold: number; reserved: number }>();
  for (const row of rows) {
    const counts = usage.get(row.quotaId) ?? { siteSold: 0, reserved: 0 };
    counts[row.state === 'CAPTURED' ? 'siteSold' : 'reserved'] = row._sum.quantity ?? 0;
    usage.set(row.quotaId, counts);
  }
  return usage;
}

export function quotaCounts(
  { id, limit, manualSold }: Pick<CampaignQuota, 'id' | 'limit' | 'manualSold'>,
  usage: Awaited<ReturnType<typeof quotaUsage>>,
) {
  const { siteSold, reserved } = usage.get(id) ?? { siteSold: 0, reserved: 0 };
  return {
    limit,
    siteSold,
    manualSold,
    reserved,
    remaining: Math.max(0, limit - siteSold - manualSold - reserved),
  };
}

const defaultWarehouse = { warehouse: { isDefault: true, isActive: true, deletedAt: null } };
const defaultInventories = { ...availabilitySelect.inventories, where: defaultWarehouse };

export async function quotaStock(reader: QuotaReader, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const component = availabilitySelect.bundleComponents.select.componentVariant.select;
  const products = await reader.product.findMany({
    where: { id: { in: ids }, deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      purchaseMode: true,
      sizeMode: true,
      variants: {
        where: { isActive: true, deletedAt: null },
        select: {
          ...availabilitySelect,
          inventories: defaultInventories,
          bundleComponents: {
            select: {
              quantity: true,
              componentVariant: { select: { ...component, inventories: defaultInventories } },
            },
          },
        },
      },
    },
  });
  return new Map(
    products.map((product) => [
      product.id,
      productAvailableQuantity(
        product.purchaseMode,
        product.variants.map((variant) => variantAvailableQuantity(variant, product.sizeMode)),
      ),
    ]),
  );
}

export async function readPublicQuotas(
  reader: QuotaReader,
  ids: string[],
  now = new Date(),
  previewCampaignId?: string,
) {
  if (!ids.length) return new Map<string, PublicCampaignQuotaDto>();
  const configured = await reader.campaignQuota.findMany({
    where: {
      productId: { in: ids },
      campaign: previewCampaignId ? { id: previewCampaignId } : activeQuotaCampaign(now),
    },
    include: {
      campaign: {
        select: {
          name: true,
          endsAt: true,
          allProducts: true,
          productIds: true,
          categoryIds: true,
          promotion: { select: { kind: true, bundleProductIds: true } },
        },
      },
      product: {
        select: {
          categories: {
            where: { category: { isActive: true, deletedAt: null } },
            select: { categoryId: true },
          },
        },
      },
    },
  });
  const quotas = configured.filter(({ campaign, product, productId }) => {
    const rule = campaign.promotion;
    return (
      rule &&
      (rule.kind !== 'BUNDLE' || rule.bundleProductIds.includes(productId)) &&
      isPromotionTarget(campaign, {
        productId,
        categoryIds: product.categories.map(({ categoryId }) => categoryId),
      })
    );
  });
  const [usage, stock] = await Promise.all([
    quotaUsage(
      reader,
      quotas.map(({ id }) => id),
    ),
    quotaStock(
      reader,
      quotas.map(({ productId }) => productId),
    ),
  ]);
  return new Map(
    quotas.map((quota) => {
      const { limit, siteSold, manualSold, remaining } = quotaCounts(quota, usage);
      return [
        quota.productId,
        {
          campaignId: quota.campaignId,
          name: quota.campaign.name,
          endsAt: quota.campaign.endsAt.toISOString(),
          limit,
          sold: siteSold + manualSold,
          remaining: Math.min(remaining, stock.get(quota.productId) ?? 0),
        },
      ] as const;
    }),
  );
}

export async function planQuotaAllocations(
  reader: QuotaReader,
  campaignId: string,
  lines: readonly { productId: string; quantity: number }[],
): Promise<QuotaAllocation[] | null> {
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of lines)
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  const quotas = await reader.campaignQuota.findMany({
    where: { campaignId, productId: { in: [...quantities.keys()] } },
  });
  const usage = await quotaUsage(
    reader,
    quotas.map(({ id }) => id),
  );
  const allocations: QuotaAllocation[] = [];
  for (const quota of quotas) {
    const quantity = quantities.get(quota.productId)!;
    if (quantity > quotaCounts(quota, usage).remaining) return null;
    allocations.push({ quotaId: quota.id, quantity });
  }
  return allocations.sort((left, right) => left.quotaId.localeCompare(right.quotaId));
}

export async function assertExclusiveQuotaWindow(
  tx: Prisma.TransactionClient,
  campaignId: string,
  window: { startsAt: Date; endsAt: Date },
  productIds: string[],
) {
  if (!productIds.length) return;
  // Scheduling edits and quota setup must serialize across campaigns.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('campaign-quota-window', 0))`;
  const overlap = await tx.campaignQuota.findFirst({
    where: {
      campaignId: { not: campaignId },
      productId: { in: productIds },
      campaign: {
        status: { not: 'ENDED' },
        startsAt: { lt: window.endsAt },
        endsAt: { gt: window.startsAt },
      },
    },
    select: { id: true },
  });
  if (overlap)
    throw new ConflictException(
      'Another campaign has a quota for this product in the same period.',
    );
}

// Call under the order row lock. Campaign capacity is shared across all orders.
export async function reacquireCampaignQuota(tx: Prisma.TransactionClient, orderId: string) {
  const released = await tx.campaignQuotaAllocation.findMany({
    where: { orderId, state: 'RELEASED' },
    select: { quotaId: true, quota: { select: { campaignId: true } } },
  });
  if (!released.length) return;

  const { campaignId } = released[0].quota;
  await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${campaignId}::uuid FOR UPDATE`;
  const campaign = await tx.campaign.findFirst({
    where: { id: campaignId, ...activeQuotaCampaign(new Date()) },
    select: { id: true },
  });
  const allocations = await tx.campaignQuotaAllocation.findMany({
    where: { orderId, state: 'RELEASED' },
    include: { quota: true },
  });
  const usage = await quotaUsage(
    tx,
    allocations.map(({ quotaId }) => quotaId),
  );
  if (
    !campaign ||
    allocations.some(({ quota, quantity }) => quantity > quotaCounts(quota, usage).remaining)
  ) {
    throw new DomainException(
      ErrorCode.CAMPAIGN_QUOTA_UNAVAILABLE,
      'سهمیهٔ کمپین برای این سفارش در دسترس نیست. برای خرید با قیمت جاری، سفارش قبلی را لغو کنید و از سبد خرید سفارش تازه ثبت کنید.',
    );
  }
  await tx.campaignQuotaAllocation.updateMany({
    where: { orderId, state: 'RELEASED' },
    data: { state: 'RESERVED' },
  });
}

export async function releaseCampaignQuota(tx: Prisma.TransactionClient, orderId: string) {
  await tx.campaignQuotaAllocation.updateMany({
    where: { orderId, state: 'RESERVED' },
    data: { state: 'RELEASED' },
  });
}

export async function releaseQuotaAfterFailedAttempt(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const otherAttempt = await tx.paymentAttempt.findFirst({
    where: {
      payment: { orderId },
      status: {
        in: ['CREATED', 'REDIRECTED', 'AWAITING_REVIEW', 'VERIFIED', 'RECONCILIATION_REQUIRED'],
      },
    },
    select: { id: true },
  });
  if (!otherAttempt) await releaseCampaignQuota(tx, orderId);
}

export async function captureCampaignQuota(tx: Prisma.TransactionClient, orderId: string) {
  const captured = await tx.campaignQuotaAllocation.updateMany({
    where: { orderId, state: 'RESERVED' },
    data: { state: 'CAPTURED' },
  });
  if (!captured.count)
    throw new ConflictException('Campaign quota is no longer reserved for this order.');
}
