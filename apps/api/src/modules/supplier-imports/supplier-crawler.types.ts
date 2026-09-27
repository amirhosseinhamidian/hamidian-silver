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
  weightGrams: number | null;
  attributes: readonly CrawledSupplierAttribute[];
  imageUrls: readonly string[];
  rawPayload: Readonly<Record<string, unknown>>;
}>;

export interface SupplierCrawlerAdapter {
  readonly key: string;
  parseProduct(html: string, sourceUrl: string): CrawledSupplierProduct;
}
