import type { components } from '@hamidian/contracts';

type Item = components['schemas']['SeoIssueItemDto'];
export const issueStatusLabels: Record<Item['status'], string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال رسیدگی',
  RESOLVED: 'حل‌شده',
};

export const issueSeverityLabels: Record<Item['severity'], string> = {
  REVIEW: 'نیازمند بررسی',
  IMPORTANT: 'مهم',
  CRITICAL: 'بحرانی',
};

const rules: Record<string, string> = {
  SEARCH_IMPRESSIONS_DROP: 'افت نمایش در نتایج جست‌وجو',
  SEARCH_CLICKS_DROP: 'افت کلیک از نتایج جست‌وجو',
  GOOGLE_INDEX_REVIEW: 'وضعیت ایندکس Google نیازمند بررسی',
  CANONICAL_CHANGED: 'تغییر Canonical',
  NOINDEX_CHANGED: 'تغییر دستور noindex',
  TECH_BUYABLE_PRODUCT_NOT_FOUND: 'محصول دارای موجودی در دسترس نیست',
  TECH_SITEMAP_NOT_FOUND: 'آدرس Sitemap در دسترس نیست',
  TECH_SITEMAP_NOINDEX: 'آدرس Sitemap دارای noindex است',
  TECH_REDIRECT_LOOP: 'حلقهٔ تغییر مسیر',
  TECH_SITEMAP_REDIRECT: 'آدرس Sitemap تغییر مسیر دارد',
  TECH_SITEMAP_NONCANONICAL: 'آدرس غیر Canonical در Sitemap',
  TECH_CONFLICTING_CANONICALS: 'Canonicalهای متناقض',
  TECH_EXPECTED_REDIRECT_MISSING: 'تغییر مسیر مورد انتظار دیده نشد',
  TECH_EXPECTED_NOINDEX_MISSING: 'دستور noindex مورد انتظار دیده نشد',
  TECH_BROKEN_INTERNAL_LINK: 'لینک داخلی شکسته',
  TECH_INVALID_JSON_LD: 'JSON-LD نامعتبر',
};

export const issueTitle = (rule: string) => rules[rule] ?? rule;

export const eventLabels: Record<string, string> = {
  DETECTED: 'شناسایی شد',
  CLEARED: 'نشانهٔ مشکل در بررسی جدید دیده نشد',
  RETURNED: 'مشکل دوباره مشاهده شد',
  SEVERITY_CHANGED: 'شدت تغییر کرد',
  UPDATED: 'رسیدگی به‌روزرسانی شد',
  NOTE: 'یادداشت ثبت شد',
};

export const deliveryLabels: Record<string, string> = {
  PENDING: 'در صف',
  DISPATCHING: 'در حال ارسال',
  SENT: 'ارسال شد',
  UNKNOWN: 'نتیجه نامشخص',
  SKIPPED: 'گیرنده در دسترس نیست',
};
