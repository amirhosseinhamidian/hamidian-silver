import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

export async function assertAvailableCampaignDestination(
  tx: Prisma.TransactionClient,
  url: URL,
  now: Date,
) {
  const [, collection, encodedSlug] = url.pathname.split('/');
  if (!encodedSlug) return;

  let slug: string;
  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    throw new BadRequestException('Choose an available campaign destination.');
  }
  if (/[\p{Cc}]/u.test(slug))
    throw new BadRequestException('Choose an available campaign destination.');
  const select = { id: true } as const;
  const filter = { slug, deletedAt: null };
  let target;
  switch (collection) {
    case 'products':
      target = await tx.product.findFirst({ where: { ...filter, status: 'ACTIVE' }, select });
      break;
    case 'categories':
      target = await tx.category.findFirst({ where: { ...filter, isActive: true }, select });
      break;
    case 'brands':
      target = await tx.brand.findFirst({ where: { ...filter, isActive: true }, select });
      break;
    case 'guide':
      target = await tx.guideArticle.findFirst({
        where: { ...filter, status: 'PUBLISHED', publishedAt: { lte: now } },
        select,
      });
      break;
    case 'campaigns':
      target = await tx.campaignLanding.findFirst({
        where: {
          slug,
          campaign: {
            kind: { not: 'MARKETING' },
            managementPurpose: null,
            status: 'ACTIVE',
            archivedAt: null,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
        },
        select: { campaignId: true },
      });
      break;
  }
  if (!target) throw new BadRequestException('Choose an available campaign destination.');
}
