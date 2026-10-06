import { BadGatewayException, Injectable } from '@nestjs/common';
import type {
  CrawledSupplierAttribute,
  CrawledSupplierCategory,
  CrawledSupplierListing,
  CrawledSupplierProduct,
  SupplierCrawlerAdapter,
  SupplierListingRequest,
} from '../supplier-crawler.types';

const MAX_ATTRIBUTES = 30;
const MAX_IMAGES = 12;
const STORE_API_PAGE_SIZE = 50;

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity);
}

function plainText(value: string | null | undefined): string {
  return decodeHtml(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match?.[1] ? plainText(match[1]) : null;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
    .replace(/[^\d.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findProduct(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProduct(item);
      if (product) return product;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (types.some((type) => type === 'Product')) return record;
  for (const child of Object.values(record)) {
    const product = findProduct(child);
    if (product) return product;
  }
  return null;
}

function structuredProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    for (const candidate of [raw, decodeHtml(raw)]) {
      try {
        const product = findProduct(JSON.parse(candidate) as unknown);
        if (product) return product;
      } catch {
        // Continue through malformed third-party structured data.
      }
    }
  }
  return null;
}

function offerFor(product: Record<string, unknown> | null): Record<string, unknown> | null {
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  return typeof offers === 'object' && offers !== null ? (offers as Record<string, unknown>) : null;
}

function availabilityFor(offer: Record<string, unknown> | null) {
  const value = typeof offer?.availability === 'string' ? offer.availability.toLowerCase() : '';
  if (value.includes('outofstock') || value.includes('soldout')) return 'OUT_OF_STOCK' as const;
  if (value.includes('instock') || value.includes('limitedavailability')) {
    return 'IN_STOCK' as const;
  }
  return 'UNKNOWN' as const;
}

function productSlug(url: URL): string | null {
  const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

function categorySlug(url: URL): string | null {
  const match = url.pathname.match(/^\/product-category\/(?:[^/]+\/)*([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

function sameHostUrls(html: string, sourceUrl: string): readonly URL[] {
  const source = new URL(sourceUrl);
  const urls: URL[] = [];
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeHtml(match[1] ?? ''), source);
      if (url.hostname === source.hostname) urls.push(url);
    } catch {
      // Ignore invalid links from supplier markup.
    }
  }
  return urls;
}

function extractAttributes(html: string): readonly CrawledSupplierAttribute[] {
  const attributes: CrawledSupplierAttribute[] = [];
  for (const match of html.matchAll(
    /<tr\b[^>]*class=["'][^"']*woocommerce-product-attributes-item[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
  )) {
    const row = match[1] ?? '';
    const key = firstMatch(
      row,
      /<(?:th|td)\b[^>]*class=["'][^"']*woocommerce-product-attributes-item__label[^"']*["'][^>]*>([\s\S]*?)<\/(?:th|td)>/i,
    );
    const value = firstMatch(
      row,
      /<(?:th|td)\b[^>]*class=["'][^"']*woocommerce-product-attributes-item__value[^"']*["'][^>]*>([\s\S]*?)<\/(?:th|td)>/i,
    );
    if (key && value && !attributes.some((attribute) => attribute.key === key)) {
      attributes.push({ key: key.slice(0, 100), value: value.slice(0, 500) });
    }
    if (attributes.length >= MAX_ATTRIBUTES) break;
  }
  return attributes;
}

function structuredImageUrls(product: Record<string, unknown> | null): readonly string[] {
  const urls: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      urls.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      const image = value as Record<string, unknown>;
      visit(image.url ?? image.contentUrl);
    }
  };
  visit(product?.image);
  return urls;
}

function extractImages(
  html: string,
  sourceUrl: string,
  product: Record<string, unknown> | null,
): readonly string[] {
  const urls = new Set<string>();
  const candidates = [
    ...html.matchAll(/\bdata-large_image=["']([^"']+)["']/gi),
    ...html.matchAll(/\bdata-large-image=["']([^"']+)["']/gi),
  ].map((match) => match[1] ?? '');
  candidates.push(...structuredImageUrls(product));
  for (const value of candidates) {
    try {
      const url = new URL(decodeHtml(value), sourceUrl);
      if (['http:', 'https:'].includes(url.protocol)) urls.add(url.toString());
    } catch {
      // Ignore invalid image URLs from supplier markup.
    }
    if (urls.size >= MAX_IMAGES) break;
  }
  return [...urls];
}

function categoryName(html: string): string | null {
  const container =
    /<nav\b[^>]*class=["'][^"']*woocommerce-breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i.exec(
      html,
    )?.[1] ??
    /<(?:span|div)\b[^>]*class=["'][^"']*posted_in[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/i.exec(
      html,
    )?.[1] ??
    '';
  const names: string[] = [];
  for (const match of container.matchAll(
    /<a\b[^>]*href=["'][^"']*\/product-category\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const name = plainText(match[1]);
    if (name) names.push(name);
  }
  return names.at(-1) ?? null;
}

@Injectable()
export class SaatYekCrawlerAdapter implements SupplierCrawlerAdapter {
  readonly key = 'saatyek-watch';

  supportsProductUrl(url: URL): boolean {
    return this.productKey(url) !== null;
  }

  productKey(url: URL): string | null {
    return productSlug(url);
  }

  categoryKey(url: URL): string | null {
    return categorySlug(url);
  }

  parseCategories(html: string, sourceUrl: string): readonly CrawledSupplierCategory[] {
    const categories = new Map<string, CrawledSupplierCategory>();
    for (const url of sameHostUrls(html, sourceUrl)) {
      const externalKey = categorySlug(url);
      if (!externalKey || categories.has(externalKey)) continue;
      const escapedPath = url.pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const name =
        firstMatch(
          html,
          new RegExp(
            `<a\\b[^>]*href=["'][^"']*${escapedPath}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
            'i',
          ),
        ) ?? externalKey;
      categories.set(externalKey, {
        externalKey,
        name: name.slice(0, 300),
        url: url.toString(),
      });
    }
    return [...categories.values()];
  }

  parseListing(payload: string, sourceUrl: string): CrawledSupplierListing {
    const products = new Map<string, string>();
    let apiProducts: unknown[] | null = null;
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (Array.isArray(parsed)) apiProducts = parsed;
    } catch {
      // Category pages are server-rendered HTML rather than Store API JSON.
    }
    if (apiProducts) {
      for (const item of apiProducts) {
        if (typeof item !== 'object' || item === null) continue;
        const record = item as Record<string, unknown>;
        const permalink = typeof record.permalink === 'string' ? record.permalink : null;
        if (!permalink) continue;
        try {
          const url = new URL(permalink, sourceUrl);
          const key = productSlug(url);
          if (key) products.set(key, url.toString());
        } catch {
          // Ignore invalid product permalinks from the API.
        }
      }
      return {
        productUrls: [...products.values()],
        childCategoryUrls: [],
        hasNextPage: apiProducts.length >= STORE_API_PAGE_SIZE,
      };
    }

    for (const url of sameHostUrls(payload, sourceUrl)) {
      const key = productSlug(url);
      if (key) products.set(key, url.toString());
    }
    const hasNextPage = /class=["'][^"']*next\s+page-numbers[^"']*["']/i.test(payload);
    return {
      productUrls: [...products.values()],
      childCategoryUrls: [],
      hasNextPage,
    };
  }

  listingUrl(baseUrl: string, page: number): string {
    const url = new URL(baseUrl);
    const category = url.pathname.match(/^(\/product-category\/(?:[^/]+\/)*)/i)?.[1];
    url.pathname = category ?? '/shop/';
    if (page > 1) url.pathname = `${url.pathname.replace(/\/$/, '')}/page/${page}/`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  listingRequest(baseUrl: string, page: number): SupplierListingRequest {
    const listingUrl = this.listingUrl(baseUrl, page);
    const url = new URL(listingUrl);
    if (url.pathname.startsWith('/product-category/')) {
      return { url: url.toString(), method: 'GET', referer: url.toString() };
    }
    const endpoint = new URL('/wp-json/wc/store/v1/products', url);
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('per_page', String(STORE_API_PAGE_SIZE));
    endpoint.searchParams.set('orderby', 'date');
    endpoint.searchParams.set('order', 'desc');
    return {
      url: endpoint.toString(),
      method: 'GET',
      referer: listingUrl,
    };
  }

  parseProduct(html: string, sourceUrl: string): CrawledSupplierProduct {
    const url = new URL(sourceUrl);
    const sourceProductKey = productSlug(url);
    const product = structuredProduct(html);
    const offer = offerFor(product);
    const title =
      (typeof product?.name === 'string' ? plainText(product.name) : null) ??
      firstMatch(html, /<h1\b[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (!sourceProductKey || !title) {
      throw new BadGatewayException('SaatYek product page did not contain a product title or key.');
    }

    const sourceSku =
      typeof product?.sku === 'string' && product.sku.trim() ? product.sku.trim() : null;
    const currency =
      typeof offer?.priceCurrency === 'string' ? offer.priceCurrency.trim().toUpperCase() : '';
    const rawPrice = parseNumber(
      typeof offer?.price === 'string' || typeof offer?.price === 'number' ? offer.price : null,
    );
    const convertedPrice = rawPrice === null ? null : currency === 'IRR' ? rawPrice / 10 : rawPrice;
    const supplierRetailPriceToman =
      convertedPrice !== null && convertedPrice > 1 ? Math.round(convertedPrice) : null;
    const attributes = extractAttributes(html);
    const weightAttribute = attributes.find((attribute) => /وزن/i.test(attribute.key));
    const weightGrams = parseNumber(weightAttribute?.value ?? null);
    const description =
      typeof product?.description === 'string' ? plainText(product.description) || null : null;

    return {
      sourceProductKey,
      sourceUrl: url.toString(),
      sourceSku,
      title: title.slice(0, 500),
      description,
      sourceCategory:
        (typeof product?.category === 'string' ? plainText(product.category) : null) ??
        categoryName(html),
      supplierRetailPriceToman,
      availability: availabilityFor(offer),
      weightGrams,
      attributes,
      imageUrls: extractImages(html, sourceUrl, product),
      rawPayload: {
        structuredProduct: product ?? {},
        sourceCurrency: currency || null,
        sourcePrice: rawPrice,
        rejectedSentinelPrice: convertedPrice !== null && convertedPrice <= 1,
      },
    };
  }
}
