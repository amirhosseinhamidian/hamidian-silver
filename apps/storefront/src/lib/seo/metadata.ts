import type { Metadata } from 'next';

import {
  STOREFRONT_BRAND_NAME,
  STOREFRONT_DEFAULT_DESCRIPTION,
  STOREFRONT_DEFAULT_TITLE,
  STOREFRONT_TITLE_TEMPLATE,
} from '@/lib/brand/identity';
import { resolveStorefrontSeoRoutePolicy } from '@/lib/seo/route-policy';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

const DEVELOPMENT_ORIGIN = 'http://localhost:3000';

export type StorefrontSeoMedia = Readonly<{
  url: string | null;
  altText: string | null;
  width?: number | null;
  height?: number | null;
}>;

export type StorefrontSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export type StorefrontPageMetadataInput = Readonly<{
  pathname: string;
  searchParams?: StorefrontSearchParams;
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalPath?: string | null;
  seoNoIndex?: boolean;
  seoOgMedia?: StorefrontSeoMedia | null;
  fallbackMedia?: StorefrontSeoMedia | null;
  absoluteTitle?: boolean;
  openGraphType?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
}>;

function configuredText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function siteName(settings: PublicSiteSettings): string {
  return configuredText(settings.seoSiteName, STOREFRONT_BRAND_NAME);
}

function defaultTitle(settings: PublicSiteSettings): string {
  return configuredText(settings.seoDefaultTitle, STOREFRONT_DEFAULT_TITLE);
}

function titleTemplate(settings: PublicSiteSettings): string {
  const template = configuredText(settings.seoTitleTemplate, STOREFRONT_TITLE_TEMPLATE);
  const tokens = template.match(/%s/g)?.length ?? 0;
  return tokens === 1 ? template : STOREFRONT_TITLE_TEMPLATE;
}

function defaultDescription(settings: PublicSiteSettings): string {
  return configuredText(settings.seoDefaultDescription, STOREFRONT_DEFAULT_DESCRIPTION);
}

function resolveDocumentTitle(
  settings: PublicSiteSettings,
  title: string,
  absolute: boolean,
): string {
  return absolute ? title : titleTemplate(settings).replace('%s', title);
}

function toUrlSearchParams(values: StorefrontSearchParams | undefined): URLSearchParams {
  const result = new URLSearchParams();
  if (!values) return result;

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => result.append(key, entry));
    } else if (value !== undefined) {
      result.set(key, value);
    }
  }

  return result;
}

function normalizeOrigin(value: string): URL {
  const url = new URL(value);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      'STOREFRONT_PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.',
    );
  }
  return new URL(url.origin);
}

export function getStorefrontMetadataBase(): URL {
  return normalizeOrigin(process.env.STOREFRONT_PUBLIC_ORIGIN?.trim() || DEVELOPMENT_ORIGIN);
}

export function getStorefrontAbsoluteUrl(
  pathname: string,
  metadataBase: URL = getStorefrontMetadataBase(),
): string {
  return new URL(pathname, metadataBase).href;
}

function resolveMedia(
  settings: PublicSiteSettings,
  preferred: StorefrontSeoMedia | null | undefined,
  fallback: StorefrontSeoMedia | null | undefined,
): StorefrontSeoMedia | null {
  const candidates = [preferred, fallback, settings.seoDefaultOgMedia];
  return candidates.find((candidate) => Boolean(candidate?.url)) ?? null;
}

const PRIVATE_CANONICAL_PREFIXES = [
  '/account',
  '/api',
  '/cart',
  '/checkout',
  '/payment',
  '/wishlist',
];

export function resolveStorefrontCanonicalPath(
  value: string | null | undefined,
  fallback: string,
): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (!/^\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^%\\\s?#]*$/.test(candidate)) {
    return fallback;
  }
  if (
    PRIVATE_CANONICAL_PREFIXES.some(
      (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  const resourcePrefix = ['/products/', '/categories/', '/brands/', '/guide/'].find((prefix) =>
    fallback.startsWith(prefix),
  );
  if (resourcePrefix && !candidate.startsWith(resourcePrefix)) return fallback;

  return candidate;
}

function openGraphImage(media: StorefrontSeoMedia | null, fallbackAlt: string) {
  if (!media?.url) return undefined;
  return [
    {
      url: media.url,
      alt: media.altText?.trim() || fallbackAlt,
      ...(media.width ? { width: media.width } : {}),
      ...(media.height ? { height: media.height } : {}),
    },
  ];
}

export function buildStorefrontRootMetadata(
  settings: PublicSiteSettings,
  metadataBase: URL = getStorefrontMetadataBase(),
  googleSiteVerification: string | undefined = process.env.GOOGLE_SITE_VERIFICATION?.trim(),
): Metadata {
  const title = defaultTitle(settings);
  const description = defaultDescription(settings);
  const image = openGraphImage(
    resolveMedia(settings, settings.seoDefaultOgMedia, null),
    siteName(settings),
  );

  return {
    metadataBase,
    applicationName: siteName(settings),
    title: {
      default: title,
      template: titleTemplate(settings),
    },
    description,
    ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: siteName(settings),
      title,
      description,
      ...(image ? { images: image } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: image } : {}),
    },
  };
}

export function buildStorefrontPageMetadata(
  settings: PublicSiteSettings,
  input: StorefrontPageMetadataInput,
  metadataBase: URL = getStorefrontMetadataBase(),
): Metadata {
  const policy = resolveStorefrontSeoRoutePolicy(
    input.pathname,
    toUrlSearchParams(input.searchParams),
  );
  const pageTitle = configuredText(input.seoTitle, input.title);
  const description = configuredText(
    input.seoDescription,
    input.description?.trim() || defaultDescription(settings),
  );
  const canonicalPath = resolveStorefrontCanonicalPath(
    input.seoCanonicalPath,
    policy.canonicalPath,
  );
  const canonical = new URL(canonicalPath, metadataBase);
  const index = policy.index && !input.seoNoIndex;
  const image = openGraphImage(
    resolveMedia(settings, input.seoOgMedia, input.fallbackMedia),
    pageTitle,
  );
  const documentTitle = resolveDocumentTitle(settings, pageTitle, Boolean(input.absoluteTitle));
  const commonOpenGraph = {
    locale: 'fa_IR',
    siteName: siteName(settings),
    url: canonical,
    title: documentTitle,
    description,
    ...(image ? { images: image } : {}),
  };

  return {
    title: input.absoluteTitle ? { absolute: pageTitle } : pageTitle,
    description,
    alternates: { canonical },
    robots: {
      index,
      follow: policy.follow,
      googleBot: {
        index,
        follow: policy.follow,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph:
      input.openGraphType === 'article'
        ? {
            type: 'article',
            ...commonOpenGraph,
            ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
          }
        : { type: 'website', ...commonOpenGraph },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: documentTitle,
      description,
      ...(image ? { images: image } : {}),
    },
  };
}

export const PRIVATE_STOREFRONT_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
