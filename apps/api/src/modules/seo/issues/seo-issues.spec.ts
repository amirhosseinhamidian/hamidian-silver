import { emptyObservation } from '../audit/seo-audit-crawl';
import {
  indexSignal,
  issueDayMs,
  performanceSignals,
  technicalSignals,
  type IssueSignal,
  type TechnicalSample,
} from './seo-issue-signals';
import { issueTransition } from './seo-issue-transitions';

const now = new Date('2026-11-26T12:00:00Z');
const limits = { days: 7, impressions: 400, clicks: 30, percent: 40 };
const base = {
  url: 'https://hamidian.shop/products/ring',
  previousDays: 7,
  currentDays: 7,
  aggregationCount: 1,
  previousImpressions: 400,
  currentImpressions: 240,
  previousClicks: 30,
  currentClicks: 19,
};

it('applies the exact drop threshold with comparable days and sufficient baseline volume', () => {
  const signals = performanceSignals(base, now, now, limits);
  expect(signals.map(({ rule, active }) => ({ rule, active }))).toEqual([
    { rule: 'SEARCH_IMPRESSIONS_DROP', active: true },
    { rule: 'SEARCH_CLICKS_DROP', active: false },
  ]);
  expect(performanceSignals({ ...base, currentDays: 6 }, now, now, limits)).toEqual([]);
  expect(performanceSignals({ ...base, aggregationCount: 2 }, now, now, limits)).toEqual([]);
  expect(performanceSignals({ ...base, previousImpressions: 399 }, now, now, limits)).toEqual([]);
  expect(
    performanceSignals({ ...base, url: 'https://hamidian.shop/guide/rings' }, now, now, limits),
  ).toEqual([]);
  const [critical] = performanceSignals(
    { ...base, previousImpressions: 800, currentImpressions: 280 },
    now,
    now,
    limits,
  );
  expect(critical.evidence.severity).toBe('CRITICAL');
});

it('distinguishes a real status change, a quieter repeat and a return after recovery', () => {
  const evidence = {
    sourceHref: '/seo',
    url: null,
    facts: ['example'],
    severity: 'CRITICAL',
  } as const;
  const incoming: IssueSignal = {
    rule: 'example',
    subject: '/',
    observedAt: now,
    active: true,
    evidence: { ...evidence, facts: ['example'] },
  };
  const yesterday = new Date(now.getTime() - issueDayMs);
  const recently = new Date(now.getTime() - 1000);
  const prior = {
    active: true,
    severity: 'CRITICAL',
    status: 'RESOLVED',
    observedAt: yesterday,
    lastQueuedAt: recently,
  } as const;
  expect(issueTransition(undefined, incoming, now)).toMatchObject({
    kind: 'DETECTED',
    notify: true,
  });
  expect(issueTransition(prior, incoming, now)).toMatchObject({
    kind: null,
    status: 'RESOLVED',
    notify: false,
  });
  expect(issueTransition({ ...prior, observedAt: now }, incoming, now)).toBeNull();
  expect(issueTransition(prior, { ...incoming, active: false }, now)).toMatchObject({
    kind: 'CLEARED',
    notify: false,
  });
  expect(issueTransition({ ...prior, active: false }, incoming, now)).toMatchObject({
    kind: 'RETURNED',
    status: 'OPEN',
    notify: false,
  });
  expect(
    issueTransition({ ...prior, active: false, lastQueuedAt: yesterday }, incoming, now),
  ).toMatchObject({ kind: 'RETURNED', notify: true });
  expect(issueTransition({ ...prior, severity: 'IMPORTANT' }, incoming, now)).toMatchObject({
    kind: 'SEVERITY_CHANGED',
    status: 'OPEN',
    notify: true,
  });
});

it('uses observed canonical and robots deltas and keeps uncertain index data in review', () => {
  const path = '/products/ring';
  const origin = 'https://hamidian.shop';
  const previous: TechnicalSample = {
    path,
    runId: 'previous',
    checkedAt: new Date(now.getTime() - issueDayMs),
    inSitemap: true,
    issues: [],
    observation: {
      ...emptyObservation(path),
      html: true,
      status: 200,
      canonicals: [origin + path],
    },
  };
  const current: TechnicalSample = {
    ...previous,
    runId: 'current',
    checkedAt: now,
    observation: {
      ...emptyObservation(path),
      html: true,
      status: 200,
      canonicals: [origin + '/products/new'],
      robots: ['noindex, follow'],
    },
  };
  expect(
    technicalSignals(origin, current, previous)
      .filter(({ active }) => active)
      .map(({ rule }) => rule),
  ).toEqual(['NOINDEX_CHANGED', 'CANONICAL_CHANGED']);
  const google = {
    verdict: 'NEUTRAL',
    coverageState: 'Discovered',
    indexingState: null,
    pageFetchState: null,
    googleCanonical: null,
    userCanonical: null,
    lastCrawlAt: null,
  };
  expect(indexSignal(origin, path, now, google, previous)).toMatchObject({
    active: true,
    evidence: { severity: 'REVIEW' },
  });
  expect(indexSignal(origin, path, now, google, current)).toBeNull();
  expect(indexSignal(origin, path, now, { ...google, verdict: null }, previous)).toBeNull();
});
