import type { Metadata } from 'next';

import { resolveStorefrontSeoRoutePolicy } from '@/lib/seo/route-policy';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

const DEFAULT_SITE_NAME = 'نقره حمیدیان';
const DEFAULT_TITLE = 'نقره حمیدیان';
const DEFAULT_TITLE_TEMPLATE = '%s | نقره حمیدیان';
const DEFAULT_DESCRIPTION = 'فروشگاه آنلاین و گالری نقره حمیدیان';
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
}>;

function configuredText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function siteName(settings: PublicSiteSettings): string {
  return configuredText(settings.seoSiteName, DEFAULT_SITE_NAME);
}

function defaultTitle(settings: PublicSiteSettings): string {
  return configuredText(settings.seoDefaultTitle, DEFAULT_TITLE);
}

function titleTemplate(settings: PublicSiteSettings): string {
  const template = configuredText(settings.seoTitleTemplate, DEFAULT_TITLE_TEMPLATE);
  return template.includes('%s') ? template : DEFAULT_TITLE_TEMPLATE;
}

function defaultDescription(settings: PublicSiteSettings): string {
  return configuredText(settings.seoDefaultDescription, DEFAULT_DESCRIPTION);
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

function openGraphImage(media: StorefrontSeoMedia | null) {
  if (!media?.url) return undefined;
  return [
    {
      url: media.url,
      ...(media.altText ? { alt: media.altText } : {}),
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
  const image = openGraphImage(resolveMedia(settings, settings.seoDefaultOgMedia, null));

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
  const canonicalPath = input.seoCanonicalPath?.trim() || policy.canonicalPath;
  const canonical = new URL(canonicalPath, metadataBase);
  const index = policy.index && !input.seoNoIndex;
  const image = openGraphImage(resolveMedia(settings, input.seoOgMedia, input.fallbackMedia));
  const documentTitle = resolveDocumentTitle(settings, pageTitle, Boolean(input.absoluteTitle));

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
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: siteName(settings),
      url: canonical,
      title: documentTitle,
      description,
      ...(image ? { images: image } : {}),
    },
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
