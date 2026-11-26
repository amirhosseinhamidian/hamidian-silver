import {
  proposeSeoOpportunities,
  type OpportunityMetrics,
  type OpportunitySubject,
} from './seo-opportunity-rules';
import { opportunityMetricWindow } from './seo-opportunity-sources';

const current: OpportunityMetrics = {
  start: '2026-11-12',
  end: '2026-11-25',
  days: 14,
  observedDays: 14,
  cappedDays: 0,
  clicks: 8,
  impressions: 800,
  ctr: 0.01,
  position: 10,
};
const previous: OpportunityMetrics = {
  ...current,
  start: '2026-10-29',
  end: '2026-11-11',
  clicks: 40,
  impressions: 1200,
  ctr: 40 / 1200,
};
const product: OpportunitySubject = {
  entityKind: 'product',
  entityId: '00000000-0000-4000-8000-000000000001',
  title: 'انگشتر نقره',
  metadata: 'انگشتر نقره',
  url: 'https://hamidian.shop/products/ring',
  current,
  previous,
  stock: 'AVAILABLE',
  blocked: false,
  auditVerified: true,
  googleReview: false,
  query: null,
  relatedArticle: null,
};

it('scores a fixed input deterministically with versioned stock and quality weights', () => {
  const snapshot = proposeSeoOpportunities(product);
  expect(snapshot.map(({ rule, score, scoreVersion }) => ({ rule, score, scoreVersion }))).toEqual([
    { rule: 'SNIPPET_CTR', score: 83, scoreVersion: 1 },
    { rule: 'INTERNAL_LINKS', score: 93, scoreVersion: 1 },
    { rule: 'CONTENT_DECLINE', score: 89, scoreVersion: 1 },
  ]);
  expect(proposeSeoOpportunities(product)).toEqual(snapshot);
  expect(proposeSeoOpportunities({ ...product, stock: 'OUT_OF_STOCK' })[0].score).toBe(73);
  expect(
    proposeSeoOpportunities({ ...product, current: { ...current, cappedDays: 1 } })[0].score,
  ).toBe(76);
  expect(proposeSeoOpportunities({ ...product, blocked: true })).toEqual([]);
  expect(
    proposeSeoOpportunities({ ...product, current: { ...current, observedDays: 13 } }),
  ).toEqual([]);
});

it('uses query relevance and an existing product-to-article relation for separate suggestions', () => {
  const category: OpportunitySubject = {
    ...product,
    entityKind: 'category',
    stock: 'NOT_OBSERVED',
    previous: { ...previous, observedDays: 10 },
    query: { label: 'انگشتر نقره ظریف', impressions: 100 },
    relatedArticle: { path: '/guide/rings', title: 'راهنمای انتخاب انگشتر' },
  };
  const proposals = proposeSeoOpportunities(category);
  expect(proposals.map(({ rule }) => rule)).toEqual([
    'SNIPPET_CTR',
    'INTERNAL_LINKS',
    'QUERY_GAP',
    'ARTICLE_CATEGORY_LINK',
  ]);
  expect(proposals[2].evidence.facts).toContain('عبارت مشاهده‌شده «انگشتر نقره ظریف» · نمایش 100');
  expect(
    proposeSeoOpportunities({
      ...category,
      query: { label: 'نقره 09121234567', impressions: 100 },
    }).map(({ rule }) => rule),
  ).not.toContain('QUERY_GAP');
});

it('reports partial periods without assigning the missing days a zero value', () => {
  const range = { start: '2026-11-01', end: '2026-11-07' };
  const totals = { observedDays: 6, clicks: 12, impressions: 300, cappedDays: 1, position: 10 };
  expect(opportunityMetricWindow(range, totals)).toMatchObject({
    days: 7,
    observedDays: 6,
    clicks: null,
    ctr: null,
    position: null,
  });
  expect(opportunityMetricWindow(range, { ...totals, observedDays: 7 })).toMatchObject({
    ctr: 0.04,
    position: 10,
  });
});
