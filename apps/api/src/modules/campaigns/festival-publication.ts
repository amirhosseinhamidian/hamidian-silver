import type {
  Campaign,
  CampaignLanding,
  CampaignPlacement,
  Prisma,
} from '../../generated/prisma/client';

type Presentation = Pick<
  Campaign,
  'name' | 'message' | 'bannerEnabled' | 'bannerPriority' | 'ctaPath' | 'ctaLabel' | 'mediaId'
>;
type Landing = Pick<
  CampaignLanding,
  | 'slug'
  | 'seoMode'
  | 'title'
  | 'story'
  | 'collectionMode'
  | 'filters'
  | 'manualProductIds'
  | 'design'
>;
type Placement = Omit<CampaignPlacement, 'campaignId' | 'startsAt' | 'endsAt'>;

type FestivalPublication = {
  schemaVersion: 1;
  version: number;
  presentation: Presentation;
  landing: Landing;
  placements: (Placement & { startsAt: string | null; endsAt: string | null })[];
};

export function festivalPublication(
  campaign: Campaign,
  landing: CampaignLanding & { placements: CampaignPlacement[] },
) {
  const { name, message, bannerEnabled, bannerPriority, ctaPath, ctaLabel, mediaId } = campaign;
  const { slug, seoMode, title, story, collectionMode, filters, manualProductIds, design } =
    landing;
  return {
    schemaVersion: 1,
    version: campaign.revision,
    presentation: { name, message, bannerEnabled, bannerPriority, ctaPath, ctaLabel, mediaId },
    landing: { slug, seoMode, title, story, collectionMode, filters, manualProductIds, design },
    placements: landing.placements.map(({ campaignId: _id, startsAt, endsAt, ...placement }) => ({
      ...placement,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
    })),
  } satisfies FestivalPublication;
}

export function readFestivalPublication(
  value: Prisma.JsonValue | undefined,
): FestivalPublication | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1)
    return null;
  return value as unknown as FestivalPublication;
}

export function publicationPlacements(publication: FestivalPublication) {
  return publication.placements.map(({ startsAt, endsAt, ...placement }) => ({
    ...placement,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  }));
}

export function activeFestivalPublication(value: Prisma.JsonValue, revision: number) {
  const publication = readFestivalPublication(value);
  return publication?.version === revision ? publication : null;
}
