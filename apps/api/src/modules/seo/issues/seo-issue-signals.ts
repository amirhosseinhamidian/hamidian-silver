import type { SeoIssueSeverity } from '../../../generated/prisma/enums';
import type { AuditObservation } from '../audit/seo-audit-crawl';
import { hasAuditNoindex } from '../audit/seo-audit-rules';
import type { GoogleIndex } from '../inspection/seo-index-observation';

export type IssueScope = { property: string; origin: string };
export type IssueEvidence = {
  sourceHref: string;
  url: string | null;
  facts: string[];
  severity: SeoIssueSeverity;
};
export type IssueSignal = {
  rule: string;
  subject: string;
  observedAt: Date;
  active: boolean;
  evidence: IssueEvidence;
};
export type PerformanceThresholds = {
  days: number;
  impressions: number;
  clicks: number;
  percent: number;
};

export const issueDayMs = 86_400_000;
const auditRules = [
  'BUYABLE_PRODUCT_NOT_FOUND',
  'SITEMAP_NOT_FOUND',
  'SITEMAP_NOINDEX',
  'REDIRECT_LOOP',
  'SITEMAP_REDIRECT',
  'SITEMAP_NONCANONICAL',
  'CONFLICTING_CANONICALS',
  'EXPECTED_REDIRECT_MISSING',
  'EXPECTED_NOINDEX_MISSING',
  'BROKEN_INTERNAL_LINK',
  'INVALID_JSON_LD',
] as const;
const criticalAudit = new Set<string>(auditRules.slice(0, 4));

export type TechnicalSample = {
  path: string;
  runId: string;
  checkedAt: Date;
  inSitemap: boolean | null;
  observation: AuditObservation | null;
  issues: { code: string; evidence: string[] }[] | null;
};

export type PerformanceSample = {
  url: string;
  previousDays: number;
  currentDays: number;
  previousImpressions: number;
  currentImpressions: number;
  previousClicks: number;
  currentClicks: number;
  aggregationCount: number;
};

export function performanceSignals(
  sample: PerformanceSample,
  end: Date,
  version: Date,
  limits: PerformanceThresholds,
): IssueSignal[] {
  if (
    sample.previousDays !== limits.days ||
    sample.currentDays !== limits.days ||
    sample.aggregationCount !== 1
  )
    return [];
  const url = new URL(sample.url);
  const commercial = /^\/(products|categories|brands)(\/|$)/.test(url.pathname);
  const minimumImpressions = commercial ? limits.impressions : Math.ceil(limits.impressions * 1.5);
  if (sample.previousImpressions < minimumImpressions) return [];
  const start = new Date(end.getTime() - (limits.days - 1) * issueDayMs).toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const sourceHref =
    '/seo?' +
    new URLSearchParams({
      kind: 'page',
      q: sample.url.slice(0, 160),
      startDate: start,
      endDate,
    });
  const metrics = [
    {
      rule: 'SEARCH_IMPRESSIONS_DROP',
      previous: sample.previousImpressions,
      current: sample.currentImpressions,
      minimum: minimumImpressions,
    },
    {
      rule: 'SEARCH_CLICKS_DROP',
      previous: sample.previousClicks,
      current: sample.currentClicks,
      minimum: limits.clicks,
    },
  ];
  return metrics
    .filter(({ previous, minimum }) => previous >= minimum)
    .map(({ rule, previous, current, minimum }) => {
      const drop = ((previous - current) / previous) * 100;
      return {
        rule,
        subject: sample.url,
        observedAt: version,
        active: drop >= limits.percent,
        evidence: {
          sourceHref,
          url: sample.url,
          severity:
            drop >= Math.max(limits.percent, 65) && previous >= 2 * minimum
              ? 'CRITICAL'
              : 'IMPORTANT',
          facts: [
            `بازهٔ جاری ${start} تا ${endDate}`,
            `طول هر بازه ${limits.days} روز`,
            `بازهٔ پیشین ${previous} · بازهٔ جاری ${current}`,
            `درصد افت ${drop.toFixed(1)} · آستانه ${limits.percent}`,
          ],
        },
      };
    });
}

export function technicalSignals(
  origin: string,
  current: TechnicalSample,
  previous?: TechnicalSample,
): IssueSignal[] {
  const observation = current.observation;
  if (
    !observation ||
    !observation.status ||
    (observation.failure && observation.failure !== 'REDIRECT_LOOP')
  )
    return [];
  const base = {
    subject: current.path,
    observedAt: current.checkedAt,
  };
  const sourceHref = `/seo/technical?runId=${current.runId}#${encodeURIComponent('check-' + current.path)}`;
  const url = new URL(current.path, origin).href;
  const make = (
    rule: string,
    active: boolean,
    severity: SeoIssueSeverity,
    facts: string[],
  ): IssueSignal => ({
    ...base,
    rule,
    active,
    evidence: { url, sourceHref, severity, facts },
  });
  const findings = new Map(current.issues?.map((issue) => [issue.code, issue]) ?? []);
  // An incomplete redirect loop provides evidence for that rule only.
  const rules = observation.failure
    ? auditRules.filter((rule) => rule === 'REDIRECT_LOOP')
    : auditRules;
  const signals = rules.map((rule) => {
    const finding = findings.get(rule);
    return make(
      `TECH_${rule}`,
      Boolean(finding),
      criticalAudit.has(rule) ? 'CRITICAL' : 'IMPORTANT',
      finding?.evidence.map((value) => value.slice(0, 1000)) ?? [`HTTP ${observation.status}`],
    );
  });
  const prior = previous?.observation;
  if (
    !prior?.html ||
    prior.failure ||
    prior.redirects.length ||
    !observation.html ||
    observation.redirects.length ||
    previous === undefined
  )
    return signals;

  const priorNoindex = hasAuditNoindex(prior.robots);
  const currentNoindex = hasAuditNoindex(observation.robots);
  signals.push(
    make(
      'NOINDEX_CHANGED',
      priorNoindex !== currentNoindex,
      currentNoindex && current.inSitemap === true ? 'CRITICAL' : 'IMPORTANT',
      [
        `پیشین ${previous.checkedAt.toISOString()} · ${priorNoindex}`,
        `جاری ${current.checkedAt.toISOString()} · ${currentNoindex}`,
      ],
    ),
  );
  if (prior.canonicals.length === 1 && observation.canonicals.length === 1) {
    signals.push(
      make('CANONICAL_CHANGED', prior.canonicals[0] !== observation.canonicals[0], 'IMPORTANT', [
        `پیشین ${prior.canonicals[0]}`,
        `جاری ${observation.canonicals[0]}`,
      ]),
    );
  }
  return signals;
}

export function indexSignal(
  origin: string,
  path: string,
  observedAt: Date,
  google: GoogleIndex,
  local: TechnicalSample | undefined,
): IssueSignal | null {
  if (
    !google.verdict ||
    !google.coverageState ||
    !['PASS', 'FAIL', 'NEUTRAL'].includes(google.verdict)
  )
    return null;
  const observation = local?.observation;
  const eligible =
    local &&
    observation?.html &&
    !observation.failure &&
    !observation.redirects.length &&
    observation.status === 200 &&
    local.inSitemap === true &&
    !hasAuditNoindex(observation.robots);
  if (
    google.verdict !== 'PASS' &&
    (!eligible ||
      !local ||
      Math.abs(observedAt.getTime() - local.checkedAt.getTime()) > 14 * issueDayMs)
  ) {
    return null;
  }
  return {
    rule: 'GOOGLE_INDEX_REVIEW',
    subject: path,
    observedAt,
    active: google.verdict !== 'PASS',
    evidence: {
      sourceHref: '/seo/index-monitoring?' + new URLSearchParams({ q: path.slice(0, 180) }),
      url: new URL(path, origin).href,
      severity: 'REVIEW',
      facts: [
        google.coverageState,
        google.verdict,
        ...(local ? [`خزش فنی ${local.checkedAt.toISOString()}`] : []),
      ],
    },
  };
}
