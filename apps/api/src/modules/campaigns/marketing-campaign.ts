import { BadRequestException } from '@nestjs/common';
import type { Campaign, Prisma } from '../../generated/prisma/client';
import { assertAvailableCampaignDestination } from '../growth-attribution/campaign-destination';
import { parseCampaignDestination } from '../growth-attribution/campaign-links.service';
import type { CampaignMarketingSettingsDto } from './dto/campaign.dto';

const origin = 'https://campaign.invalid';

export const salesCampaignFilter: Prisma.CampaignWhereInput = {
  kind: { not: 'FESTIVAL' },
  marketingDestinationPath: null,
  OR: [
    { managementPurpose: 'SALES' },
    { promotion: { isNot: null } },
    { quotas: { some: {} } },
    { orderQuotes: { some: {} } },
  ],
};

export async function validateMarketingDestination(
  tx: Prisma.TransactionClient,
  destination: string,
  now: Date,
) {
  const url = parseCampaignDestination(origin, destination);
  if (url.searchParams.has('page'))
    throw new BadRequestException('Choose a campaign destination without a page number.');
  const path = url.href.slice(origin.length);
  if (path.length > 1000)
    throw new BadRequestException('The encoded campaign destination is too long.');
  await assertAvailableCampaignDestination(tx, url, now);
  return path;
}

export async function prepareMarketingSettings(
  tx: Prisma.TransactionClient,
  input: CampaignMarketingSettingsDto,
  current?: Campaign,
) {
  const relatedFestivalId =
    input.relatedFestivalId === undefined
      ? (current?.relatedFestivalId ?? null)
      : (input.relatedFestivalId?.toLowerCase() ?? null);
  const relatedSalesCampaignId =
    input.relatedSalesCampaignId === undefined
      ? (current?.relatedSalesCampaignId ?? null)
      : (input.relatedSalesCampaignId?.toLowerCase() ?? null);
  const marketingDestinationPath = await validateMarketingDestination(
    tx,
    input.destinationPath,
    new Date(),
  );
  if (relatedFestivalId && relatedFestivalId !== current?.relatedFestivalId) {
    const target = await tx.campaign.findFirst({
      where: { id: relatedFestivalId, kind: 'FESTIVAL', archivedAt: null },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('Choose an available festival.');
  }
  if (relatedSalesCampaignId && relatedSalesCampaignId !== current?.relatedSalesCampaignId) {
    const target = await tx.campaign.findFirst({
      where: { id: relatedSalesCampaignId, ...salesCampaignFilter },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('Choose an available sales campaign.');
  }
  return { marketingDestinationPath, relatedFestivalId, relatedSalesCampaignId };
}
