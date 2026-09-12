import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { PrismaClient } from '../src/generated/prisma/client';
import {
  type ContentAuditIssue,
  type ContentAuditMedia,
  type ContentAuditSnapshot,
  validateProductionContent,
} from './production-content-audit.rules';

const CONTENT_ROUTES: Readonly<Record<string, string>> = {
  ABOUT: '/about',
  CONTACT: '/contact',
  SERVICES: '/services',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  SIZE_GUIDE: '/size-guide',
  FAQ: '/faq',
};
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_CONCURRENCY = 6;

type MediaRecord = Readonly<{
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  deletedAt: Date | null;
}>;

function requiredText(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required for the production content audit.`);
  return value;
}

function requiredUrl(key: string, allowPath = false): URL {
  const url = new URL(requiredText(key));
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (!allowPath && url.pathname !== '/')
  ) {
    throw new Error(
      `${key} must be an HTTP(S) ${allowPath ? 'URL' : 'origin'} without credentials, query, or fragment.`,
    );
  }
  return url;
}

function addIssue(
  issues: ContentAuditIssue[],
  severity: ContentAuditIssue['severity'],
  code: string,
  subject: string,
  message: string,
) {
  issues.push({ severity, code, subject, message });
}

function encodedStorageKey(storageKey: string): string {
  return storageKey
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function safeStorageKey(storageKey: string): boolean {
  if (!storageKey.trim() || storageKey.includes('\\')) return false;
  const segments = storageKey.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

async function request(url: URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'user-agent': 'HamidianSilverContentAudit/1.0',
      ...init.headers,
    },
  });
}

async function mapWithConcurrency<Value>(
  values: readonly Value[],
  task: (value: Value) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await task(values[index]);
    }
  });
  await Promise.all(workers);
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function internalLinks(html: string, pageUrl: URL, origin: URL): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const rawHref = decodeHtmlAttribute(match[1].trim());
    if (!rawHref || rawHref.startsWith('#')) continue;

    let url: URL;
    try {
      url = new URL(rawHref, pageUrl);
    } catch {
      continue;
    }
    if (url.origin !== origin.origin || !['http:', 'https:'].includes(url.protocol)) continue;
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) continue;
    url.hash = '';
    links.add(`${url.pathname}${url.search}`);
  }
  return [...links];
}

async function auditMediaFiles(
  media: readonly ContentAuditMedia[],
  mediaStorageRoot: string,
  mediaPublicBaseUrl: URL,
  issues: ContentAuditIssue[],
) {
  const uniqueMedia = [...new Map(media.map((item) => [item.id, item])).values()];
  const safeMedia: ContentAuditMedia[] = [];

  for (const item of uniqueMedia) {
    if (!safeStorageKey(item.storageKey)) {
      addIssue(issues, 'failure', 'MEDIA_PATH_UNSAFE', item.subject, 'کلید فایل media ناامن است.');
      continue;
    }
    const targetPath = resolve(mediaStorageRoot, ...item.storageKey.split('/'));
    const relativePath = relative(mediaStorageRoot, targetPath);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      addIssue(
        issues,
        'failure',
        'MEDIA_PATH_UNSAFE',
        item.subject,
        'مسیر فایل از media root خارج می‌شود.',
      );
      continue;
    }
    safeMedia.push(item);

    try {
      const file = await stat(targetPath);
      if (!file.isFile() || file.size <= 0) {
        addIssue(issues, 'failure', 'MEDIA_FILE_INVALID', item.subject, 'فایل media معتبر نیست.');
      } else if (file.size !== item.sizeBytes) {
        addIssue(
          issues,
          'failure',
          'MEDIA_SIZE_MISMATCH',
          item.subject,
          'اندازه فایل با metadata دیتابیس تطابق ندارد.',
        );
      }
    } catch {
      addIssue(
        issues,
        'failure',
        'MEDIA_FILE_MISSING',
        item.subject,
        'فایل media روی storage وجود ندارد.',
      );
    }
  }

  await mapWithConcurrency(safeMedia, async (item) => {
    const url = new URL(
      `${mediaPublicBaseUrl.pathname.replace(/\/+$/, '')}/${encodedStorageKey(item.storageKey)}`,
      mediaPublicBaseUrl,
    );
    try {
      const response = await request(url, { headers: { range: 'bytes=0-0' } });
      if (!response.ok) {
        await response.body?.cancel();
        addIssue(
          issues,
          'failure',
          'MEDIA_HTTP_BROKEN',
          item.subject,
          `نشانی عمومی تصویر پاسخ ${response.status} داد.`,
        );
        return;
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
      if (contentType !== item.mimeType) {
        addIssue(
          issues,
          'failure',
          'MEDIA_HTTP_MIME',
          item.subject,
          `Content-Type عمومی ${contentType ?? 'ثبت‌نشده'} است، نه ${item.mimeType}.`,
        );
      }
      await response.body?.cancel();
    } catch (error) {
      addIssue(
        issues,
        'failure',
        'MEDIA_HTTP_UNAVAILABLE',
        item.subject,
        error instanceof Error ? error.message : 'دریافت تصویر عمومی ناموفق بود.',
      );
    }
  });
}

async function auditStorefrontLinks(
  origin: URL,
  initialPaths: readonly string[],
  issues: ContentAuditIssue[],
) {
  const discoveredPaths = new Set<string>();

  const auditPaths = async (paths: readonly string[], discoverLinks: boolean) => {
    await mapWithConcurrency(paths, async (pathname) => {
      const url = new URL(pathname, origin);
      try {
        const response = await request(url);
        if (!response.ok) {
          await response.body?.cancel();
          addIssue(
            issues,
            'failure',
            'STOREFRONT_LINK_BROKEN',
            pathname,
            `صفحه پاسخ ${response.status} داد.`,
          );
          return;
        }
        const finalUrl = new URL(response.url);
        if (finalUrl.origin !== origin.origin) {
          await response.body?.cancel();
          addIssue(
            issues,
            'failure',
            'STOREFRONT_LINK_EXTERNAL_REDIRECT',
            pathname,
            'لینک داخلی به دامنه دیگری هدایت شد.',
          );
          return;
        }
        if (discoverLinks && response.headers.get('content-type')?.includes('text/html')) {
          const html = await response.text();
          internalLinks(html, finalUrl, origin).forEach((link) => discoveredPaths.add(link));
        } else {
          await response.body?.cancel();
        }
      } catch (error) {
        addIssue(
          issues,
          'failure',
          'STOREFRONT_LINK_UNAVAILABLE',
          pathname,
          error instanceof Error ? error.message : 'دریافت صفحه ناموفق بود.',
        );
      }
    });
  };

  const uniqueInitialPaths = [...new Set(initialPaths)].sort();
  await auditPaths(uniqueInitialPaths, true);
  const secondWave = [...discoveredPaths].filter(
    (pathname) => !uniqueInitialPaths.includes(pathname),
  );
  await auditPaths(secondWave, false);
}

async function run(): Promise<void> {
  const databaseUrl = requiredText('DATABASE_URL');
  const mediaStorageRoot = resolve(requiredText('MEDIA_STORAGE_ROOT'));
  const mediaPublicBaseUrl = requiredUrl('MEDIA_PUBLIC_BASE_URL', true);
  const storefrontOrigin = requiredUrl('CONTENT_AUDIT_ORIGIN');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const [products, categories, brands, countries, pages, settings, heroSlides] =
      await Promise.all([
        prisma.product.findMany({
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            brand: true,
            country: true,
            seoOgMedia: true,
            categories: { include: { category: true } },
            variants: {
              where: { isActive: true, deletedAt: null },
              include: { size: true, inventories: { include: { warehouse: true } } },
            },
            media: {
              orderBy: [{ sortOrder: 'asc' }, { mediaId: 'asc' }],
              include: { media: true },
            },
          },
        }),
        prisma.category.findMany({
          where: { isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { image: true, seoOgMedia: true },
        }),
        prisma.brand.findMany({
          where: { isActive: true, deletedAt: null },
          orderBy: { name: 'asc' },
          include: { image: true, heroImage: true, seoOgMedia: true, originCountry: true },
        }),
        prisma.country.findMany({
          where: { isActive: true, deletedAt: null },
          include: { image: true },
        }),
        prisma.storefrontContentPage.findMany({
          include: { heroMedia: true, seoOgMedia: true, sections: true },
        }),
        prisma.siteSettings.findUnique({
          where: { id: 'site' },
          include: {
            catalogHeroMedia: true,
            seoDefaultOgMedia: true,
            seoOrganizationLogoMedia: true,
            seoHomeOgMedia: true,
          },
        }),
        prisma.homepageHeroSlide.findMany({
          where: { isActive: true },
          include: { media: true },
        }),
      ]);

    const media: ContentAuditMedia[] = [];
    const addMedia = (record: MediaRecord | null, subject: string, altText?: string | null) => {
      if (!record) return;
      media.push({
        id: record.id,
        subject,
        storageKey: record.storageKey,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        width: record.width,
        height: record.height,
        altText: altText?.trim() || record.altText,
        deleted: record.deletedAt !== null,
      });
    };

    for (const product of products) {
      product.media.forEach((association) =>
        addMedia(association.media, `تصویر محصول ${product.name}`, association.altText),
      );
      addMedia(product.seoOgMedia, `تصویر SEO محصول ${product.name}`);
    }
    for (const category of categories) {
      addMedia(category.image, `تصویر دسته‌بندی ${category.name}`);
      addMedia(category.seoOgMedia, `تصویر SEO دسته‌بندی ${category.name}`);
    }
    for (const brand of brands) {
      addMedia(brand.image, `تصویر برند ${brand.name}`);
      addMedia(brand.heroImage, `تصویر Hero برند ${brand.name}`);
      addMedia(brand.seoOgMedia, `تصویر SEO برند ${brand.name}`);
    }
    for (const country of countries) {
      addMedia(country.image, `تصویر کشور ${country.name}`);
    }
    for (const page of pages) {
      addMedia(page.heroMedia, `تصویر صفحه ${page.title}`);
      addMedia(page.seoOgMedia, `تصویر SEO صفحه ${page.title}`);
    }
    addMedia(settings?.catalogHeroMedia ?? null, 'تصویر Hero کاتالوگ');
    addMedia(settings?.seoDefaultOgMedia ?? null, 'تصویر پیش‌فرض SEO');
    addMedia(settings?.seoOrganizationLogoMedia ?? null, 'لوگوی سازمان SEO');
    addMedia(settings?.seoHomeOgMedia ?? null, 'تصویر SEO صفحه اصلی');
    heroSlides.forEach((slide) => addMedia(slide.media, `اسلاید Hero ${slide.id}`));

    const snapshot: ContentAuditSnapshot = {
      products: products.map((product) => ({
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        salePriceToman: product.salePriceToman,
        compareAtPriceToman: product.compareAtPriceToman,
        sizeMode: product.sizeMode,
        brandName: product.brand?.isActive && !product.brand.deletedAt ? product.brand.name : null,
        countryName:
          product.country?.isActive && !product.country.deletedAt ? product.country.name : null,
        categoryNames: product.categories
          .filter(({ category }) => category.isActive && !category.deletedAt)
          .map(({ category }) => category.name),
        mediaCount: product.media.filter(({ media: item }) => !item.deletedAt).length,
        primaryMediaCount: product.media.filter(
          ({ isPrimary, media: item }) => isPrimary && !item.deletedAt,
        ).length,
        variants: product.variants.map((variant) => ({
          sku: variant.sku,
          label: variant.size?.label ?? variant.name,
          inventory: variant.inventories.map((inventory) => ({
            warehouse: inventory.warehouse.name,
            warehouseActive: inventory.warehouse.isActive && !inventory.warehouse.deletedAt,
            onHand: inventory.onHand,
            reserved: inventory.reserved,
          })),
        })),
      })),
      categories: categories.map((category) => ({
        name: category.name,
        slug: category.slug,
        description: category.description,
        hasImage: Boolean(category.image && !category.image.deletedAt),
      })),
      brands: brands.map((brand) => ({
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        countryName:
          brand.originCountry?.isActive && !brand.originCountry.deletedAt
            ? brand.originCountry.name
            : null,
        hasImage: Boolean(brand.image && !brand.image.deletedAt),
      })),
      settings: {
        exists: Boolean(settings),
        reviewedByUser: Boolean(settings?.updatedByUserId),
        footerAbout: settings?.footerAbout ?? null,
        contactAddress: settings?.contactAddress ?? null,
        contactPhoneNumbers: settings?.contactPhoneNumbers ?? [],
        contactEmail: settings?.contactEmail ?? null,
        socialUrls: [settings?.instagramUrl, settings?.telegramUrl, settings?.baleUrl].filter(
          (value): value is string => Boolean(value),
        ),
      },
      pages: pages.map((page) => ({
        key: page.key,
        title: page.title,
        body: page.body,
        sectionCount: page.sections.length,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        reviewedByUser: Boolean(page.updatedByUserId),
      })),
      media,
    };

    const issues = validateProductionContent(snapshot);
    await auditMediaFiles(media, mediaStorageRoot, mediaPublicBaseUrl, issues);

    const storefrontPaths = [
      '/',
      '/products',
      '/brands',
      ...Object.values(CONTENT_ROUTES),
      ...products.map((product) => `/products/${encodeURIComponent(product.slug)}`),
      ...categories.map((category) => `/categories/${encodeURIComponent(category.slug)}`),
      ...brands.map((brand) => `/brands/${encodeURIComponent(brand.slug)}`),
    ];
    await auditStorefrontLinks(storefrontOrigin, storefrontPaths, issues);

    console.log(
      `Audited ${products.length} products, ${categories.length} categories, ${brands.length} brands, ${pages.length} content pages, and ${new Set(media.map((item) => item.id)).size} media files.`,
    );
    issues.sort(
      (left, right) =>
        left.severity.localeCompare(right.severity) ||
        left.code.localeCompare(right.code) ||
        left.subject.localeCompare(right.subject, 'fa'),
    );
    for (const issue of issues) {
      const method = issue.severity === 'failure' ? console.error : console.warn;
      method(`${issue.severity.toUpperCase()} [${issue.code}] ${issue.subject}: ${issue.message}`);
    }

    const failures = issues.filter((issue) => issue.severity === 'failure');
    const warnings = issues.filter((issue) => issue.severity === 'warning');
    if (failures.length > 0) {
      throw new Error(
        `Production content audit failed with ${failures.length} failure(s) and ${warnings.length} warning(s).`,
      );
    }
    console.log(`Production content audit passed with ${warnings.length} warning(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
