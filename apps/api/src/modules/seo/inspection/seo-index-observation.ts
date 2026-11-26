import { auditOrigin, auditPath, type AuditObservation } from '../audit/seo-audit-crawl';
import { hasAuditNoindex } from '../audit/seo-audit-rules';
import { searchConsoleRecord, SearchConsoleError } from '../search-console/search-console-errors';

export function inspectionScope(property: string, originValue?: string) {
  const origin = auditOrigin(originValue);
  if (!origin || !origin.startsWith('https://')) return null;
  const { hostname, port } = new URL(origin);
  if (port) return null;
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice('sc-domain:'.length);
    return domain && (hostname === domain || hostname.endsWith(`.${domain}`)) ? origin : null;
  }
  return property === `${origin}/` ? origin : null;
}

export function inspectionPath(origin: string, input: string) {
  const path = auditPath(origin, input);
  return path &&
    (!path.includes('?') || /\?page=(?:[2-9]|[1-9]\d{1,2})$/.test(path)) &&
    !path.includes('/products/products/') &&
    !path.startsWith('/guide:')
    ? path
    : null;
}

export function readGoogleIndex(body: unknown) {
  const result = searchConsoleRecord(searchConsoleRecord(body)?.inspectionResult);
  if (!result) throw new SearchConsoleError('invalid_response');
  const index = searchConsoleRecord(result.indexStatusResult);
  const text = (key: string, length = 240) => {
    const value = index?.[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, length) : null;
  };
  const lastCrawl = text('lastCrawlTime');
  const time = lastCrawl ? Date.parse(lastCrawl) : NaN;
  return {
    verdict: text('verdict'),
    coverageState: text('coverageState'),
    indexingState: text('indexingState'),
    pageFetchState: text('pageFetchState'),
    googleCanonical: text('googleCanonical', 2000),
    userCanonical: text('userCanonical', 2000),
    lastCrawlAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
  };
}

export type GoogleIndex = ReturnType<typeof readGoogleIndex>;

export function compareIndexEvidence(
  url: string,
  google: GoogleIndex | null,
  local: AuditObservation | null,
  inSitemap: boolean | null,
): string[] {
  if (!google || !local?.html || local.failure || local.status !== 200 || local.redirects.length) {
    return [];
  }
  const noindex = hasAuditNoindex(local.robots);
  const findings: string[] = [];
  if (noindex && google.verdict === 'PASS') findings.push('GOOGLE_PASS_LOCAL_NOINDEX');
  if (
    !noindex &&
    (['FAIL', 'NEUTRAL'].includes(google.verdict ?? '') ||
      /^(?:url is unknown|unknown to google|discovered)/i.test(google.coverageState ?? ''))
  ) {
    findings.push('GOOGLE_COVERAGE_HTTP_200');
  }
  const canonical = [...new Set(local.canonicals)];
  if (canonical.length === 1 && google.googleCanonical) {
    const compare = (value: string) => {
      try {
        const target = new URL(value);
        if (!['http:', 'https:'].includes(target.protocol)) return null;
        return target.origin + decodeURI(target.pathname).replace(/\/$/, '') + target.search;
      } catch {
        return null;
      }
    };
    const localCanonical = compare(canonical[0]);
    const googleCanonical = compare(google.googleCanonical);
    if (localCanonical && googleCanonical && localCanonical !== googleCanonical) {
      findings.push('GOOGLE_CANONICAL_DIFFERS');
    }
  }
  if (!noindex && inSitemap === false && google.verdict === 'PASS' && canonical[0] === url) {
    findings.push('GOOGLE_PASS_OUTSIDE_SITEMAP');
  }
  return findings;
}
