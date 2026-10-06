export type CrawledSupplierAttribute = Readonly<{
  key: string;
  value: string;
}>;

export type CrawledSupplierProduct = Readonly<{
  sourceProductKey: string;
  sourceUrl: string;
  sourceSku: string | null;
  title: string;
  description: string | null;
  sourceCategory: string | null;
  supplierRetailPriceToman: number | null;
  availability: 'UNKNOWN' | 'IN_STOCK' | 'OUT_OF_STOCK';
  weightGrams: number | null;
  attributes: readonly CrawledSupplierAttribute[];
  imageUrls: readonly string[];
  rawPayload: Readonly<Record<string, unknown>>;
}>;

export type CrawledSupplierCategory = Readonly<{
  externalKey: string;
  name: string;
  url: string;
}>;

export type CrawledSupplierListing = Readonly<{
  productUrls: readonly string[];
  childCategoryUrls: readonly string[];
  hasNextPage: boolean;
}>;

export type SupplierListingRequest = Readonly<{
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  contentType?: string;
  referer: string;
  requiresXsrfSession?: boolean;
}>;

export interface SupplierCrawlerAdapter {
  readonly key: string;
  supportsProductUrl(url: URL): boolean;
  productKey(url: URL): string | null;
  categoryKey(url: URL): string | null;
  parseProduct(html: string, sourceUrl: string): CrawledSupplierProduct;
  parseCategories(html: string, sourceUrl: string): readonly CrawledSupplierCategory[];
  parseListing(payload: string, sourceUrl: string): CrawledSupplierListing;
  listingUrl(baseUrl: string, page: number): string;
  listingRequest(baseUrl: string, page: number): SupplierListingRequest;
}
