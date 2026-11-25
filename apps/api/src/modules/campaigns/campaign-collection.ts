import type { Campaign, CampaignLanding, Prisma } from '../../generated/prisma/client';
import type { CatalogService } from '../catalog/catalog.service';
import {
  PublicCatalogAvailability,
  type PublicCatalogFacetsDto,
  type PublicCatalogFacetsQueryDto,
} from '../catalog/dto/public-catalog-facets.dto';
import type { CatalogPromotionCandidate } from '../promotions/promotion-presentation';
import type { CampaignCollectionFiltersDto } from './dto/campaign-landing.dto';

type Collection = Pick<CampaignLanding, 'collectionMode' | 'manualProductIds'> & {
  filters: Prisma.JsonValue | Prisma.InputJsonObject;
};

export type CampaignProductFilters = Pick<
  PublicCatalogFacetsQueryDto,
  'scopeCategory' | 'scopeBrand' | 'minPriceToman' | 'maxPriceToman' | 'sort'
>;

export function emptyCampaignProducts(page = 1, pageSize = 24) {
  const facets: PublicCatalogFacetsDto | undefined = undefined;
  return { items: [], total: 0, totalPages: 0, page, pageSize, facets };
}

export function readCampaignProducts(
  catalog: CatalogService,
  tx: Prisma.TransactionClient,
  campaign: Campaign,
  landing: Collection,
  page: number,
  pageSize: number,
  selected: CampaignProductFilters = {},
  {
    pickedIds,
    candidateIds,
    includeFilterOptions,
    campaignPromotions,
  }: {
    pickedIds?: string[];
    candidateIds?: string[];
    includeFilterOptions?: boolean;
    campaignPromotions?: readonly CatalogPromotionCandidate[];
  } = {},
) {
  const { minimumQuantity = 1, ...filters } = landing.filters as CampaignCollectionFiltersDto;
  const minPriceToman = Math.max(filters.minPriceToman ?? 1, selected.minPriceToman ?? 1);
  const maxPriceToman = Math.min(
    filters.maxPriceToman ?? Infinity,
    selected.maxPriceToman ?? Infinity,
  );
  if (minPriceToman > maxPriceToman) return Promise.resolve(emptyCampaignProducts(page, pageSize));
  const manualProductIds =
    landing.collectionMode === 'MANUAL' ? landing.manualProductIds : undefined;
  const matchingIds =
    pickedIds && manualProductIds
      ? pickedIds.filter((id) => manualProductIds.includes(id))
      : (pickedIds ?? manualProductIds);

  return catalog.readCampaignCollection(
    tx,
    {
      ...filters,
      ...selected,
      sort: selected.sort ?? filters.sort,
      availability: PublicCatalogAvailability.IN_STOCK,
      minPriceToman,
      maxPriceToman: Number.isFinite(maxPriceToman) ? maxPriceToman : undefined,
    },
    {
      allProducts: campaign.allProducts,
      productIds: campaign.productIds,
      categoryIds: campaign.categoryIds,
      minimumQuantity,
      includeFilterOptions,
      ...(candidateIds ? { candidateIds } : {}),
      ...(matchingIds ? { manualProductIds: matchingIds } : {}),
    },
    page,
    pageSize,
    campaignPromotions,
  );
}
