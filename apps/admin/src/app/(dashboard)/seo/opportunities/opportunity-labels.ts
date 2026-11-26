import type { components } from '@hamidian/contracts';

export type Opportunity = components['schemas']['SeoOpportunityItemDto'];
export type OpportunityAction = components['schemas']['SeoOpportunityUpdateDto']['action'];
export const opportunityPath = '/seo/opportunities';
export const statusLabels: Record<Opportunity['status'], string> = {
  PENDING: 'در انتظار تصمیم',
  APPROVED: 'تأییدشده',
  DEFERRED: 'به‌تعویق‌افتاده',
  TASK_CREATED: 'دارای تسک اصلاحی',
  REJECTED: 'ردشده',
};

export const actionLabels: Record<OpportunityAction, string> = {
  APPROVE: 'تأیید پیشنهاد',
  REJECT: 'رد پیشنهاد',
  DEFER: 'تعویق پیشنهاد',
  CREATE_TASK: 'ساخت تسک اصلاحی',
  REOPEN: 'بازگرداندن به صف',
  IMPLEMENT: 'ثبت اجرای تغییر',
  MEASURE: 'محاسبهٔ گزارش پیش‌وپس',
};

const rules: Record<string, string> = {
  SNIPPET_CTR: 'بازبینی عنوان و توضیح متا',
  INTERNAL_LINKS: 'تقویت لینک‌سازی داخلی',
  CONTENT_DECLINE: 'بازبینی ساختار محتوا',
  QUERY_GAP: 'بازبینی پوشش موضوع',
  ARTICLE_CATEGORY_LINK: 'ارتباط مقاله با دسته',
};

export const opportunityLabel = (rule: string) => rules[rule] ?? rule;
export const rankWeights: Record<keyof Opportunity['evidence']['components'], string> = {
  signal: 'شدت فرصت',
  demand: 'حجم جست‌وجو',
  quality: 'کیفیت داده',
  commercial: 'اهمیت تجاری',
  stock: 'موجودی',
};

export const stockLabels: Record<string, string> = {
  AVAILABLE: 'دارای موجودی قابل فروش',
  OUT_OF_STOCK: 'فاقد موجودی قابل فروش',
  NOT_OBSERVED: 'شاهد موجودی در دسترس نیست',
};

export function readPage(value: string | string[] | undefined) {
  return typeof value === 'string' && /^\d{1,5}$/.test(value)
    ? Math.max(1, Math.min(10_000, Number(value)))
    : 1;
}
