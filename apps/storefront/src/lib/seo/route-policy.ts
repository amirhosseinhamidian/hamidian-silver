export type StorefrontSeoRoutePolicy = Readonly<{
  canonicalPath: string;
  follow: boolean;
  index: boolean;
  reason: 'public-page' | 'catalog-page' | 'catalog-variant' | 'private-page' | 'unknown-page';
}>;

const PUBLIC_STATIC_ROUTES = new Set([
  '/',
  '/about',
  '/brands',
  '/contact',
  '/faq',
  '/privacy',
  '/services',
  '/size-guide',
  '/terms',
]);

const PRIVATE_ROUTE_PREFIXES = ['/account', '/api', '/cart', '/checkout', '/payment', '/wishlist'];
function normalizePathname(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
}

function isRouteOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isCatalogDocument(pathname: string): boolean {
  if (pathname === '/products') return true;
  return /^\/(?:products|categories|brands)\/[^/]+$/.test(pathname);
}

function activeEntries(searchParams: URLSearchParams): Array<readonly [string, string]> {
  return [...searchParams.entries()].filter(([, value]) => value.trim().length > 0);
}

function canonicalPage(searchParams: URLSearchParams): number | null {
  const rawPage = searchParams.get('page');
  if (!rawPage || !/^\d+$/.test(rawPage)) return null;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page > 1 ? page : null;
}

function withPage(pathname: string, page: number | null): string {
  return page ? `${pathname}?page=${page}` : pathname;
}

export function resolveStorefrontSeoRoutePolicy(
  pathname: string,
  searchParams: URLSearchParams = new URLSearchParams(),
): StorefrontSeoRoutePolicy {
  const normalizedPath = normalizePathname(pathname);

  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => isRouteOrChild(normalizedPath, prefix))) {
    return {
      canonicalPath: normalizedPath,
      index: false,
      follow: false,
      reason: 'private-page',
    };
  }

  if (isCatalogDocument(normalizedPath)) {
    const entries = activeEntries(searchParams);
    const page = canonicalPage(searchParams);
    const rawPage = searchParams.get('page')?.trim();
    const hasInvalidPage = Boolean(rawPage && rawPage !== '1' && page === null);
    const hasCatalogVariant = entries.some(([key]) => key !== 'page') || hasInvalidPage;

    return {
      canonicalPath: hasCatalogVariant ? normalizedPath : withPage(normalizedPath, page),
      index: !hasCatalogVariant,
      follow: true,
      reason: hasCatalogVariant ? 'catalog-variant' : 'catalog-page',
    };
  }

  if (PUBLIC_STATIC_ROUTES.has(normalizedPath)) {
    return {
      canonicalPath: normalizedPath,
      index: true,
      follow: true,
      reason: 'public-page',
    };
  }

  return {
    canonicalPath: normalizedPath,
    index: false,
    follow: false,
    reason: 'unknown-page',
  };
}
