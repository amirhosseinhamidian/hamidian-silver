import { BadGatewayException, Injectable } from '@nestjs/common';
import type {
  CrawledSupplierAttribute,
  CrawledSupplierProduct,
  SupplierCrawlerAdapter,
} from '../supplier-crawler.types';

const MAX_ATTRIBUTES = 30;
const MAX_IMAGES = 12;

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
