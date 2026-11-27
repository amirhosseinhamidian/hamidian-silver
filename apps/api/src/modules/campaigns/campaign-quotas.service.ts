import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { isPromotionTarget } from '../promotions/promotion-engine';
import { PromotionsService } from '../promotions/promotions.service';
import { assertExclusiveQuotaWindow, quotaCounts, quotaStock, quotaUsage } from './campaign-quota';
import type { CampaignQuotaAdminDto, SaveCampaignQuotaDto } from './dto/campaign-quota.dto';

@Injectable()
export class CampaignQuotasService {
  constructor(
    private readonly db: PrismaService,
    private readonly promotions: PromotionsService,
  ) {}

  async get(campaignId: string, slug: string): Promise<CampaignQuotaAdminDto> {
    const [campaign, product] = await Promise.all([
      this.db.campaign.findUnique({ where: { id: campaignId }, select: { id: true } }),
      this.db.product.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } }),
    ]);
    if (!campaign || !product) throw new NotFoundException('Campaign or product not found.');
    const quota = await this.db.campaignQuota.findUnique({
      where: { campaignId_productId: { campaignId, productId: product.id } },
    });
    const [usage, stock] = await Promise.all([
      quotaUsage(this.db, quota ? [quota.id] : []),
      quotaStock(this.db, [product.id]),
    ]);
    return {
      slug,
      name: product.name,
      ...quotaCounts(quota ?? { id: '', limit: 0, manualSold: 0 }, usage),
      revision: quota?.revision ?? 0,
      sellableStock: stock.get(product.id) ?? 0,
    };
  }

  async save(
    campaignId: string,
    input: SaveCampaignQuotaDto,
    actorUserId: string,
  ): Promise<CampaignQuotaAdminDto> {
    return this.db.$transaction(async (tx) => {
      await this.promotions.lockCampaign(tx, campaignId);
      const [campaign, product] = await Promise.all([
        tx.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { promotion: true } }),
        tx.product.findUnique({
          where: { slug: input.slug },
          select: {
            id: true,
            name: true,
            categories: {
              where: { category: { isActive: true, deletedAt: null } },
              select: { categoryId: true },
            },
          },
        }),
      ]);
      if (campaign.marketingDestinationPath)
        throw new BadRequestException(
          'Advertising campaigns use a separate advertising budget and destination.',
        );
      if (!product) throw new NotFoundException('Product not found.');
      const rule = campaign.promotion;
      const target = {
        productId: product.id,
        categoryIds: product.categories.map(({ categoryId }) => categoryId),
      };
      const where = { campaignId_productId: { campaignId, productId: product.id } };
      const current = await tx.campaignQuota.findUnique({ where });
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('The quota changed. Reload before saving.');
      const increases = input.limit > (current?.limit ?? 0);
      if (
        increases &&
        (!rule ||
          !isPromotionTarget(campaign, target) ||
          (rule.kind === 'BUNDLE' && !rule.bundleProductIds.includes(product.id)) ||
          campaign.status === 'ENDED' ||
          campaign.endsAt <= new Date())
      ) {
        throw new BadRequestException(
          'Set an eligible product and promotion for a current campaign.',
        );
      }
      if (!current) {
        if (campaign.status === 'ACTIVE' || campaign.status === 'PAUSED')
          throw new ConflictException(
            'Configure new product quotas before publishing the campaign.',
          );
        await assertExclusiveQuotaWindow(tx, campaignId, campaign, [product.id]);
      }
      const [usage, stock] = await Promise.all([
        quotaUsage(tx, current ? [current.id] : []),
        quotaStock(tx, [product.id]),
      ]);
      const sellableStock = stock.get(product.id) ?? 0;
      const counts = quotaCounts(current ?? { id: '', limit: 0, manualSold: 0 }, usage);
      const used = counts.siteSold + counts.reserved + input.manualSold;
      if (used > input.limit)
        throw new BadRequestException(
          'The quota is below confirmed, manual, or reserved quantities.',
        );
      if (increases && input.limit - (current ? used : 0) > sellableStock)
        throw new BadRequestException('The quota exceeds sellable stock.');
      const revision = input.expectedRevision + 1;
      const data = { limit: input.limit, manualSold: input.manualSold, revision };
      const saved = await tx.campaignQuota.upsert({
        where,
        create: { campaignId, productId: product.id, ...data },
        update: data,
      });
      await tx.campaignQuotaChange.create({ data: { quotaId: saved.id, actorUserId, ...data } });
      return {
        slug: input.slug,
        name: product.name,
        ...quotaCounts(saved, usage),
        revision,
        sellableStock,
      };
    });
  }
}
