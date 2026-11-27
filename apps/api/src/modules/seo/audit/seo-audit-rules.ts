import { auditPath, type AuditObservation } from './seo-audit-crawl';

export const AUDIT_RULE_VERSION = 1;

export type AuditFinding = {
  code: string;
  severity: 'ERROR' | 'REVIEW';
  evidence: string[];
};

export type AuditIssue = AuditFinding & { state: 'NEW' | 'EXISTING' };

type RuleContext = {
  origin: string;
  path: string;
  source: string;
  sourcePath: string | null;
  expectedCanonical: string | null;
  mustNoIndex: boolean;
  inSitemap: boolean;
  productStock: boolean | null;
};

export function hasAuditNoindex(robots: string[]): boolean {
  return robots.some((value) => {
    let applicable = true;
    return value
      .toLowerCase()
      .split(',')
      .some((entry) => {
        const scoped = /^([\w-]+):\s*(noindex|none|index|follow|nofollow)$/.exec(entry.trim());
        if (scoped) {
          applicable = scoped[1] === 'googlebot';
          return applicable && ['noindex', 'none'].includes(scoped[2]);
        }
        return applicable && /^(noindex|none)$/.test(entry.trim());
      });
  });
}

export function evaluateAudit(context: RuleContext, observation: AuditObservation): AuditFinding[] {
  const { origin, path, inSitemap, expectedCanonical, sourcePath, productStock } = context;
  const { status, failure, redirects, robots, canonicals, finalPath } = observation;
  const findings: AuditFinding[] = [];
  const add = (code: string, severity: AuditFinding['severity'], ...evidence: string[]) => {
    findings.push({ code, severity, evidence });
  };

  if (context.source === 'SITEMAP_FILE') {
    if (failure || status !== 200)
      add('SITEMAP_UNAVAILABLE', 'REVIEW', failure ?? `HTTP ${status}`);
    return findings;
  }
  if (failure) {
    const evidence = [failure, ...redirects.map(({ status, to }) => `${status} → ${to ?? '—'}`)];
    add('CRAWL_UNVERIFIED', 'REVIEW', ...evidence);
    if (['REDIRECT_LOOP', 'REDIRECT_LIMIT'].includes(failure)) {
      add(failure, failure === 'REDIRECT_LOOP' ? 'ERROR' : 'REVIEW', ...evidence.slice(1));
    }
    return findings;
  }
  if (context.source === 'KNOWN_REDIRECT' && expectedCanonical) {
    const first = redirects[0];
    if (!first || ![301, 308].includes(first.status) || first.to !== expectedCanonical) {
      add(
        'EXPECTED_REDIRECT_MISSING',
        'ERROR',
        first ? `${first.status} → ${first.to ?? '—'}` : `HTTP ${status} · ${finalPath}`,
        expectedCanonical,
      );
    }
  }
  if (status === 404 || status === 410) {
    const evidence = [`HTTP ${status} · ${finalPath}`];
    if (sourcePath) add('BROKEN_INTERNAL_LINK', 'ERROR', sourcePath, ...evidence);
    if (inSitemap) add('SITEMAP_NOT_FOUND', 'ERROR', ...evidence);
    if (productStock === true)
      add('BUYABLE_PRODUCT_NOT_FOUND', 'ERROR', 'checkout stock > 0', ...evidence);
    return findings;
  }
  if (inSitemap && redirects.length)
    add('SITEMAP_REDIRECT', 'ERROR', ...redirects.map(({ status, to }) => `${status} → ${to}`));
  if (!observation.html) return findings;

  const noindex = hasAuditNoindex(robots);
  if (inSitemap && noindex) add('SITEMAP_NOINDEX', 'ERROR', ...robots);
  if (context.mustNoIndex && !noindex && !redirects.length) {
    add('EXPECTED_NOINDEX_MISSING', 'ERROR', ...(robots.length ? robots : ['robots: —']));
  }
  if (canonicals.length > 1 && new Set(canonicals).size > 1) {
    add('CONFLICTING_CANONICALS', 'ERROR', ...canonicals);
  }
  if (canonicals.length === 1 || (canonicals.length > 1 && new Set(canonicals).size === 1)) {
    const actual = auditPath(origin, canonicals[0]);
    const encodedExpected = expectedCanonical && auditPath(origin, expectedCanonical);
    if ((encodedExpected && actual !== encodedExpected && !redirects.length) || !actual) {
      add(
        'UNEXPECTED_CANONICAL',
        'REVIEW',
        canonicals[0],
        ...(encodedExpected ? [encodedExpected] : []),
      );
    } else if (inSitemap && actual !== path && !redirects.length) {
      add('SITEMAP_NONCANONICAL', 'ERROR', canonicals[0]);
    }
  } else if (!noindex && !canonicals.length) {
    add('MISSING_CANONICAL', 'REVIEW', 'link[rel=canonical]: —');
  }
  if (!noindex && !observation.title) add('MISSING_TITLE', 'REVIEW', 'title: —');
  if (!noindex && !observation.description) {
    add('MISSING_DESCRIPTION', 'REVIEW', 'meta[name=description]: —');
  }
  if (observation.malformedSchema) {
    add('INVALID_JSON_LD', 'ERROR', 'script[type=application/ld+json]');
  }
  return findings;
}

export function auditMetadataKey(observation: AuditObservation): string | null {
  if (observation.failure || !observation.html || hasAuditNoindex(observation.robots)) return null;
  const normalize = (value: string) =>
    value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return observation.title && observation.description
    ? JSON.stringify([normalize(observation.title), normalize(observation.description)])
    : null;
}
