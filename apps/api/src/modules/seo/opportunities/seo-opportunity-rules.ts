import { normalizeCatalogSearch } from '../../catalog/catalog-search';
import type { SeoEntityKind } from '../dto/search-entity.dto';

export const opportunityScoreVersion = 1;
export const opportunityWindowDays = 14;
export const opportunityWeights = {
  signal: 35,
  demand: 20,
  quality: 20,
  commercial: 15,
  stock: 10,
} as const;
export const opportunityRules = [
  'SNIPPET_CTR',
  'INTERNAL_LINKS',
  'CONTENT_DECLINE',
  'QUERY_GAP',
  'ARTICLE_CATEGORY_LINK',
] as const;
export type OpportunityRule = (typeof opportunityRules)[number];

export type OpportunityMetrics = {
  start: string;
  end: string;
  days: number;
  observedDays: number;
  cappedDays: number;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type OpportunitySubject = {
  entityKind: SeoEntityKind;
  entityId: string;
  title: string;
  url: string;
  metadata: string;
  current: OpportunityMetrics;
  previous: OpportunityMetrics;
  stock: 'AVAILABLE' | 'OUT_OF_STOCK' | 'NOT_OBSERVED';
  blocked: boolean;
  auditVerified: boolean;
  googleReview: boolean;
  query: { label: string; impressions: number } | null;
  relatedArticle: { path: string; title: string } | null;
};

export type OpportunityEvidence = {
  reason: string;
  recommendation: string;
  facts: string[];
  limitations: string[];
  reportHref: string;
  current: OpportunityMetrics;
  previous: OpportunityMetrics;
  stock: OpportunitySubject['stock'];
  components: {
    signal: number;
    demand: number;
    quality: number;
    commercial: number;
    stock: number;
  };
};

export type OpportunityProposal = {
  rule: OpportunityRule;
  entityKind: SeoEntityKind;
  entityId: string;
  title: string;
  url: string;
  score: number;
  scoreVersion: number;
  evidence: OpportunityEvidence;
};

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const commercialWeight: Record<SeoEntityKind, number> = {
  product: 1,
  category: 0.9,
  brand: 0.55,
  article: 0.45,
};

function queryIsUseful(query: string, knownText: string) {
  if (!/^[\p{L}\p{M}\s\u200c-]{5,100}$/u.test(query)) return false;
  const normalized = normalizeCatalogSearch(query);
  const tokens = normalized.split(' ').filter((word) => word.length >= 3);
  if (tokens.length < 2) return false;
  const seen = new Set(normalizeCatalogSearch(knownText).split(' '));
  return tokens.some((token) => seen.has(token)) && tokens.some((token) => !seen.has(token));
}

export function proposeSeoOpportunities(subject: OpportunitySubject): OpportunityProposal[] {
  const { current, previous, entityKind, query, relatedArticle } = subject;
  if (subject.blocked || current.observedDays !== current.days || (current.impressions ?? 0) < 200)
    return [];
  const impressions = current.impressions ?? 0;
  const facts = [`نمایش ${impressions} · کلیک ${current.clicks ?? '—'}`];
  const limitations = [
    'متریک‌ها از گزارش Web در سطح صفحه به دست آمده‌اند.',
    ...(current.cappedDays ? [`گزارش در ${current.cappedDays} روز به سقف سطرهای منبع رسید.`] : []),
    ...(subject.auditVerified ? [] : ['شاهد تازهٔ خزش برای این نشانی در دسترس نیست.']),
    ...(entityKind === 'category'
      ? ['موجودی از نمونهٔ محصولات مستقیم این دسته بررسی شده است.']
      : []),
    ...(subject.googleReview ? ['وضعیت گزارش‌شدهٔ Google نیازمند بررسی است.'] : []),
  ];
  const proposals: OpportunityProposal[] = [];
  const add = (
    rule: OpportunityRule,
    strength: number,
    reason: string,
    recommendation: string,
    evidence: string[],
  ) => {
    const components = {
      signal: round(opportunityWeights.signal * (0.45 + 0.55 * clamp(strength))),
      demand: round(opportunityWeights.demand * clamp(impressions / 1200)),
      quality: round(opportunityWeights.quality * (current.cappedDays ? 0.65 : 1)),
      commercial: round(opportunityWeights.commercial * commercialWeight[entityKind]),
      stock: round(
        opportunityWeights.stock *
          (subject.stock === 'AVAILABLE' ? 1 : subject.stock === 'OUT_OF_STOCK' ? 0 : 0.5),
      ),
    };
    proposals.push({
      rule,
      entityKind,
      entityId: subject.entityId,
      title: subject.title,
      url: subject.url,
      score: Math.round(Object.values(components).reduce((total, value) => total + value, 0)),
      scoreVersion: opportunityScoreVersion,
      evidence: {
        reason,
        recommendation,
        facts: [...facts, ...evidence],
        limitations,
        current,
        previous,
        reportHref: `/seo/entities/${entityKind}/${subject.entityId}?${new URLSearchParams({ startDate: current.start, endDate: current.end })}`,
        stock: subject.stock,
        components,
      },
    });
  };
  const position = current.position;
  if (
    current.ctr !== null &&
    current.ctr <= 0.018 &&
    position !== null &&
    position >= 4 &&
    position <= 18
  ) {
    add(
      'SNIPPET_CTR',
      1 - current.ctr / 0.018,
      'صفحه مشاهده می‌شود و نرخ کلیک پایین است.',
      'عنوان و توضیح متا را با نام فعلی صفحه و ویژگی‌های تأییدشده بازبینی کنید. تغییر عنوان پیشنهادی را با متن صفحه و عبارت‌های جست‌وجو تطبیق دهید.',
      [`CTR ${round(current.ctr * 100)}٪ · رتبهٔ میانگین ${round(position)}`],
    );
  }
  if (position !== null && position >= 8 && position <= 15) {
    add(
      'INTERNAL_LINKS',
      1 - Math.abs(position - 10) / 7,
      'این صفحه در بازهٔ نزدیک به صفحهٔ اول نتیجهٔ جست‌وجو قرار دارد.',
      'از صفحه یا مقالهٔ مرتبط منتشرشده یک لینک زمینه‌دار با متن طبیعی به همین URL اضافه کنید و مقصد لینک را بررسی کنید.',
      [`رتبهٔ میانگین وزنی ${round(position)}`],
    );
  }
  const decline =
    previous.observedDays === previous.days &&
    (previous.clicks ?? 0) >= 20 &&
    (previous.impressions ?? 0) >= 200 &&
    current.clicks !== null
      ? 1 - current.clicks / (previous.clicks ?? 1)
      : 0;
  if (decline >= 0.25) {
    add(
      'CONTENT_DECLINE',
      decline,
      'کلیک نسبت به بازهٔ هم‌طول قبلی افت کرده است.',
      'زیرعنوان‌ها، پاسخ به پرسش‌های خرید و توضیح ویژگی‌ها را بازبینی کنید. فصل، موجودی و کمپین‌ها را در گزارش اثر ثبت کنید.',
      [`کلیک پیشین ${previous.clicks} · افت ${round(decline * 100)}٪`],
    );
  } else if (query && query.impressions >= 50 && queryIsUseful(query.label, subject.metadata)) {
    add(
      'QUERY_GAP',
      query.impressions / 250,
      'بخشی از یک عبارت پرتکرار در متن‌های توصیفی بررسی‌شده دیده نشد.',
      'پوشش این موضوع را در متن کامل و مطالب مرتبط بررسی کنید. در صورت ارتباط، پاسخ کوتاه و مستند را در بخش مناسب اضافه کنید.',
      [`عبارت مشاهده‌شده «${query.label}» · نمایش ${query.impressions}`],
    );
  }
  if (entityKind === 'category' && relatedArticle) {
    add(
      'ARTICLE_CATEGORY_LINK',
      0.65,
      'مقالهٔ منتشرشده به یکی از محصولات دسته مرتبط است و به خود دسته متصل نیست.',
      'ارتباط مقاله و دسته را بررسی کنید. در صورت تناسب، رابطه را از ویرایش مقاله ثبت کنید و لینک دسته را در متن مرتبط قرار دهید.',
      [relatedArticle.title, relatedArticle.path],
    );
  }
  return proposals;
}
