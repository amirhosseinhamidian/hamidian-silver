import { isIP } from 'node:net';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COUNTRY_LOOKUP_BASE_URL = 'https://api.country.is';
const COUNTRY_LOOKUP_TIMEOUT_MS = 2_500;
const KNOWN_COUNTRY_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const UNKNOWN_COUNTRY_CACHE_TTL_MS = 5 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 1_000;

type CountryCacheEntry = Readonly<{
  countryCode: string | null;
  expiresAt: number;
}>;

const countryCache = new Map<string, CountryCacheEntry>();

function normalizeIp(value: string | null): string | null {
  if (!value) return null;

  let candidate = value.split(',', 1)[0]?.trim() ?? '';
  if (!candidate) return null;

  if (candidate.startsWith('[')) {
    const closingBracket = candidate.indexOf(']');
    if (closingBracket > 0) candidate = candidate.slice(1, closingBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  }

  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const mappedIpv4 = candidate.slice(7);
    if (isIP(mappedIpv4) === 4) return mappedIpv4;
  }

  return isIP(candidate) > 0 ? candidate : null;
}

function requestIp(request: Request): string | null {
  return (
    normalizeIp(request.headers.get('x-real-ip')) ??
    normalizeIp(request.headers.get('x-forwarded-for'))
  );
}

function cacheCountry(ip: string, countryCode: string | null) {
  if (countryCache.size >= MAX_CACHE_ENTRIES && !countryCache.has(ip)) {
    const oldestKey = countryCache.keys().next().value;
    if (oldestKey) countryCache.delete(oldestKey);
  }

  countryCache.set(ip, {
    countryCode,
    expiresAt:
      Date.now() +
      (countryCode === null ? UNKNOWN_COUNTRY_CACHE_TTL_MS : KNOWN_COUNTRY_CACHE_TTL_MS),
  });
}

async function lookupCountry(ip: string): Promise<string | null> {
  const cached = countryCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.countryCode;
  if (cached) countryCache.delete(ip);

  try {
    const response = await fetch(`${COUNTRY_LOOKUP_BASE_URL}/${ip}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(COUNTRY_LOOKUP_TIMEOUT_MS),
    });
    if (!response.ok) {
      cacheCountry(ip, null);
      return null;
    }

    const payload = (await response.json()) as { country?: unknown };
    const countryCode =
      typeof payload.country === 'string' && /^[A-Za-z]{2}$/.test(payload.country)
        ? payload.country.toUpperCase()
        : null;
    cacheCountry(ip, countryCode);
    return countryCode;
  } catch {
    cacheCountry(ip, null);
    return null;
  }
}

function locationResponse(countryCode: string | null): Response {
  return Response.json(
    {
      countryCode,
      isIranian: countryCode === null ? null : countryCode === 'IR',
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const ip = requestIp(request);
  if (!ip) return locationResponse(null);

  return locationResponse(await lookupCountry(ip));
}
