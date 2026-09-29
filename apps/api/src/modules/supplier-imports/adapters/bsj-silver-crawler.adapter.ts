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

function hrefs(html: string, sourceUrl: string): readonly URL[] {
  const urls: URL[] = [];
  for (const match of html.matchAll(/\b(?:href|data-href)=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeHtml(match[1] ?? ''), sourceUrl);
      if (url.hostname === new URL(sourceUrl).hostname) urls.push(url);
    } catch {
      // Ignore invalid links from third-party markup.
    }
  }
  return urls;
}

function listingValues(value: unknown): readonly string[] {
  const values: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      values.push(item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item === 'object' && item !== null) Object.values(item).forEach(visit);
  };
  visit(value);
  return values;
}

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

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match?.[1] ? plainText(match[1]) : null;
}

function parseNumber(value: string | null): number | null {
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

function structuredProduct(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script[1] ?? '')) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const product = candidates.find(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          (item as Record<string, unknown>)['@type'] === 'Product',
      );
      if (product && typeof product === 'object') return product as Record<string, unknown>;
    } catch {
      // Ignore malformed third-party structured data and continue with visible markup.
    }
  }
  return null;
}

function structuredAvailability(product: Record<string, unknown> | null) {
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const offer =
    typeof offers === 'object' && offers !== null ? (offers as Record<string, unknown>) : null;
  const value = typeof offer?.availability === 'string' ? offer.availability.toLowerCase() : '';
  if (value.includes('outofstock') || value.includes('soldout')) return 'OUT_OF_STOCK' as const;
  if (value.includes('instock') || value.includes('limitedavailability')) {
    return 'IN_STOCK' as const;
  }
  return 'UNKNOWN' as const;
}

function extractAttributes(html: string): readonly CrawledSupplierAttribute[] {
  const attributes: CrawledSupplierAttribute[] = [];
  const items = html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi);
  for (const item of items) {
    const markup = item[0];
    const key = firstMatch(
      markup,
      /<span\b[^>]*class=["'][^"']*technicalspecs-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    const value = firstMatch(
      markup,
      /<span\b[^>]*class=["'][^"']*technicalspecs-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    const normalizedValue =
      value ||
      plainText(markup)
        .replace(key ?? '', '')
        .trim();
    if (key && normalizedValue && !attributes.some((attribute) => attribute.key === key)) {
      attributes.push({ key: key.slice(0, 100), value: normalizedValue.slice(0, 500) });
    }
    if (attributes.length >= MAX_ATTRIBUTES) break;
  }
  return attributes;
}

function extractImages(html: string, sourceUrl: string): readonly string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/\bdata-imgurl=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeHtml(match[1] ?? ''), sourceUrl);
      if (['http:', 'https:'].includes(url.protocol)) urls.add(url.toString());
    } catch {
      // Ignore invalid third-party image URLs.
    }
    if (urls.size >= MAX_IMAGES) break;
  }
  return [...urls];
}

@Injectable()
export class BsjSilverCrawlerAdapter implements SupplierCrawlerAdapter {
  readonly key = 'bsj-silver';

  parseCategories(html: string, sourceUrl: string): readonly CrawledSupplierCategory[] {
    const categories = new Map<string, CrawledSupplierCategory>();
    for (const url of hrefs(html, sourceUrl)) {
      const match = url.pathname.match(/^\/product\/category\/(\d+)(?:-([^/]+))?\/?$/);
      if (!match?.[1]) continue;
      const anchorPattern = new RegExp(
        `<a\\b[^>]*href=["'][^"']*\\/product\\/category\\/${match[1]}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
        'i',
      );
      const name = firstMatch(html, anchorPattern) ?? decodeURIComponent(match[2] ?? match[1]);
      categories.set(match[1], {
        externalKey: match[1],
        name: name.slice(0, 300),
        url: url.toString(),
      });
    }
    return [...categories.values()];
  }

  parseListing(payload: string, sourceUrl: string): CrawledSupplierListing {
    const products = new Map<string, string>();
    const childCategories = new Map<string, string>();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      // Some BSJ deployments can still return server-rendered listing markup.
    }
    const candidates = parsed
      ? listingValues(parsed).flatMap((value) => hrefs(`href="${value}"`, sourceUrl))
      : hrefs(payload, sourceUrl);
    for (const url of candidates) {
      const match = url.pathname.match(/^\/product\/(\d+)(?:-|\/|$)/);
      if (match?.[1]) {
        url.searchParams.delete('quick');
        products.set(match[1], url.toString());
      }
      const categoryMatch = url.pathname.match(/^\/product\/category\/(\d+)(?:-|\/|$)/);
      if (categoryMatch?.[1]) childCategories.set(categoryMatch[1], url.toString());
    }
    const currentPage = Number(new URL(sourceUrl).searchParams.get('page') ?? '1');
    const response =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    const total = Number(response?.total ?? Number.NaN);
    const to = Number(response?.to ?? Number.NaN);
    const hasNextPageByCount = Number.isFinite(total) && Number.isFinite(to) && to < total;
    const hasNextPageByLink = hrefs(listingValues(parsed ?? payload).join(' '), sourceUrl).some(
      (url) => {
        const page = Number(url.searchParams.get('page') ?? '0');
        return Number.isFinite(page) && page > currentPage;
      },
    );
    return {
      productUrls: [...products.values()],
      childCategoryUrls: [...childCategories.values()],
      hasNextPage: hasNextPageByCount || hasNextPageByLink,
    };
  }

  listingUrl(baseUrl: string, page: number): string {
    const url = new URL(baseUrl);
    if (!url.pathname.startsWith('/product/category/')) url.pathname = '/product';
    url.searchParams.set('like', '0');
    url.searchParams.set('campain', '0');
    url.searchParams.set('pagination', '1');
    url.searchParams.set('quick', 'attr');
    url.searchParams.set('order', 'new');
    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    url.hash = '';
    return url.toString();
  }

  listingRequest(baseUrl: string, page: number): SupplierListingRequest {
    const listingUrl = new URL(this.listingUrl(baseUrl, page));
    const categoryId = listingUrl.pathname.match(/^\/product\/category\/(\d+)/)?.[1] ?? '';
    const endpoint = new URL('/product/searching/1-جستجو', listingUrl);
    const body = new URLSearchParams({
      q: '',
      loadCategory: 'false',
      shop: '',
      like: '0',
      campain: '0',
      status: '0',
      id: categoryId,
      page: String(page),
      pagination: '1',
      quick: 'attr',
      order: 'new',
    });
    body.append('price[]', '0');
    body.append('price[]', '0');
    return {
      url: endpoint.toString(),
      method: 'POST',
      body: body.toString(),
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: listingUrl.toString(),
    };
  }

  parseProduct(html: string, sourceUrl: string): CrawledSupplierProduct {
    const product = structuredProduct(html);
    const title =
      firstMatch(
        html,
        /<div\b[^>]*id=["']frmSecProductMain["'][^>]*>[\s\S]*?<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
      ) ?? (typeof product?.name === 'string' ? product.name.trim() : null);
    const sourceSku = typeof product?.sku === 'string' ? product.sku.trim() : null;
    const sourceProductKey =
      sourceSku ?? new URL(sourceUrl).pathname.match(/\/product\/(\d+)(?:-|\/|$)/)?.[1] ?? null;
    if (!title || !sourceProductKey) {
      throw new BadGatewayException('BSJ product page did not contain a product title or key.');
    }

    const attributes = extractAttributes(html);
    const approximateWeight = attributes.find((attribute) => attribute.key === 'وزن تقریبی');
    const visiblePrice = firstMatch(
      html,
      /<span\b[^>]*id=["']frmLblPayablePriceAmount["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    const structuredPrice =
      typeof product?.price === 'string'
        ? parseNumber(product.price)
        : typeof product?.price === 'number' && Number.isFinite(product.price)
          ? product.price
          : null;
    const structuredCurrency =
      typeof product?.priceCurrency === 'string' ? product.priceCurrency : '';
    const visiblePriceToman = parseNumber(visiblePrice);
    const sourceCategory = firstMatch(
      html,
      /<a\b[^>]*class=["'][^"']*cro-category-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const images = extractImages(html, sourceUrl);
    const structuredImages = Array.isArray(product?.image)
      ? product.image.filter((item): item is string => typeof item === 'string')
      : typeof product?.image === 'string'
        ? [product.image]
        : [];
    const imageUrls = [...new Set([...images, ...structuredImages])].slice(0, MAX_IMAGES);

    return {
      sourceProductKey: sourceProductKey.slice(0, 120),
      sourceUrl,
      sourceSku: sourceSku?.slice(0, 120) ?? null,
      title: title.slice(0, 300),
      description:
        typeof product?.description === 'string' ? plainText(product.description) || null : null,
      sourceCategory: sourceCategory?.slice(0, 300) ?? null,
      supplierRetailPriceToman:
        visiblePriceToman === null
          ? structuredPrice === null
            ? null
            : Math.round(
                structuredCurrency.toUpperCase() === 'IRR' ? structuredPrice / 10 : structuredPrice,
              )
          : Math.round(visiblePriceToman),
      availability: structuredAvailability(product),
      weightGrams: parseNumber(approximateWeight?.value ?? null),
      attributes,
      imageUrls,
      rawPayload: {
        adapter: this.key,
        structuredProduct: product,
        extractedAt: new Date().toISOString(),
      },
    };
  }
}
