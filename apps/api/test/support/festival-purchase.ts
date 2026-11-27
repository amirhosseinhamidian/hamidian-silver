import { randomUUID } from 'node:crypto';
import { formatTehranDate } from '../../src/modules/campaigns/campaign-calendar';
import type { CampaignLandingsService } from '../../src/modules/campaigns/campaign-landings.service';
import type { CampaignsService } from '../../src/modules/campaigns/campaigns.service';

type FestivalPurchaseFixture = {
  slug: string;
  productSlug: string;
  ownerId: string;
  startsAt: Date;
  endsAt: Date;
  budgetToman: number;
};

export function createFestivalDraft(
  campaigns: CampaignsService,
  { slug, productSlug, ownerId, startsAt, endsAt, budgetToman }: FestivalPurchaseFixture,
) {
  return campaigns.create(
    {
      kind: 'FESTIVAL',
      slug,
      name: 'جشنوارهٔ آزمایشی',
      goal: 'آزمون مسیر خرید',
      message: 'محصولات جشنواره',
      allProducts: false,
      productSlugs: [productSlug],
      categorySlugs: [],
      startsTehran: formatTehranDate(startsAt),
      endsTehran: formatTehranDate(endsAt),
      budgetToman,
      bannerEnabled: false,
      bannerPriority: 0,
    },
    ownerId,
  );
}

export async function publishFestival(
  campaigns: CampaignsService,
  landings: CampaignLandingsService,
  festival: Awaited<ReturnType<typeof createFestivalDraft>>,
  productSlug: string,
) {
  const { id, slug, name, ownerId } = festival;
  const current = await landings.editor(id);
  const landing = await landings.save(
    id,
    {
      slug,
      title: name,
      story: 'شرایط فروش جشنواره',
      seoMode: 'TEMPORARY',
      collectionMode: 'MANUAL',
      filters: { minimumQuantity: 1 },
      manualProductSlugs: [productSlug],
      placements: [],
      expectedRevision: current.revision,
    },
    ownerId,
  );
  const approved = await campaigns.transition(
    id,
    { action: 'APPROVE', expectedRevision: landing.revision, requestId: randomUUID() },
    ownerId,
  );
  return campaigns.transition(
    id,
    { action: 'PUBLISH_NOW', expectedRevision: approved.revision, requestId: randomUUID() },
    ownerId,
  );
}
