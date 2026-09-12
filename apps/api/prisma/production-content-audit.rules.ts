export type ContentAuditIssue = Readonly<{
  severity: 'failure' | 'warning';
  code: string;
  subject: string;
  message: string;
}>;

export type ContentAuditMedia = Readonly<{
  id: string;
  subject: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  deleted: boolean;
}>;

export type ContentAuditSnapshot = Readonly<{
  products: ReadonlyArray<
    Readonly<{
      name: string;
      slug: string;
      shortDescription: string | null;
      description: string | null;
      salePriceToman: number | null;
      compareAtPriceToman: number | null;
      sizeMode: string;
      brandName: string | null;
      countryName: string | null;
      categoryNames: readonly string[];
      mediaCount: number;
      primaryMediaCount: number;
      variants: ReadonlyArray<
        Readonly<{
          sku: string;
          label: string | null;
          inventory: ReadonlyArray<
            Readonly<{
              warehouse: string;
              warehouseActive: boolean;
              onHand: number;
              reserved: number;
            }>
          >;
        }>
      >;
    }>
  >;
  categories: ReadonlyArray<
    Readonly<{
      name: string;
      slug: string;
      description: string | null;
      hasImage: boolean;
    }>
  >;
  brands: ReadonlyArray<
    Readonly<{
      name: string;
      slug: string;
      description: string | null;
      countryName: string | null;
      hasImage: boolean;
    }>
  >;
  settings: Readonly<{
    exists: boolean;
    reviewedByUser: boolean;
    footerAbout: string | null;
    contactAddress: string | null;
    contactPhoneNumbers: readonly string[];
    contactEmail: string | null;
    socialUrls: readonly string[];
  }>;
  pages: ReadonlyArray<
    Readonly<{
      key: string;
      title: string;
      body: string | null;
      sectionCount: number;
      seoTitle: string | null;
      seoDescription: string | null;
      reviewedByUser: boolean;
    }>
  >;
  media: readonly ContentAuditMedia[];
}>;

const CONTENT_PAGE_KEYS = [
  'ABOUT',
  'CONTACT',
  'SERVICES',
  'TERMS',
  'PRIVACY',
  'SIZE_GUIDE',
  'FAQ',
] as const;

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const PLACEHOLDER_TEXT_PATTERNS = [
  /\b(?:demo|dummy|example|placeholder|sample|test|todo|tbd)\b/i,
  /(?:نشانی واقعی فروشگاه|(?:داده|اطلاعات|محصول|مجموعه|آدرس|نشانی) (?:آزمایشی|فرضی|نمونه))/,
];
const DEMO_PHONE_DIGITS = new Set(['09123456789', '09121234567', '02112345678']);

function normalizedText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function containsPlaceholder(value: string | null | undefined): boolean {
  const normalized = normalizedText(value);
  return (
    normalized.length > 0 && PLACEHOLDER_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function isValidPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      !containsPlaceholder(url.hostname)
    );
  } catch {
    return false;
  }
}

function normalizePhoneDigits(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');

  return digits.startsWith('98') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}

function addIssue(
  issues: ContentAuditIssue[],
  severity: ContentAuditIssue['severity'],
  code: string,
  subject: string,
  message: string,
) {
  issues.push({ severity, code, subject, message });
}

function requireRealText(
  issues: ContentAuditIssue[],
  value: string | null | undefined,
  code: string,
  subject: string,
  label: string,
  minimumLength = 2,
) {
  const normalized = normalizedText(value);
  if (normalized.length < minimumLength) {
    addIssue(issues, 'failure', code, subject, `${label} ثبت نشده یا بیش از حد کوتاه است.`);
  } else if (containsPlaceholder(normalized)) {
    addIssue(
      issues,
      'failure',
      `${code}_PLACEHOLDER`,
      subject,
      `${label} شامل داده دمو یا placeholder است.`,
    );
  }
}

export function validateProductionContent(snapshot: ContentAuditSnapshot): ContentAuditIssue[] {
  const issues: ContentAuditIssue[] = [];

  if (snapshot.products.length === 0) {
    addIssue(issues, 'failure', 'CATALOG_NO_PRODUCTS', 'کاتالوگ', 'هیچ محصول فعالی وجود ندارد.');
  }
  if (snapshot.categories.length === 0) {
    addIssue(
      issues,
      'failure',
      'CATALOG_NO_CATEGORIES',
      'کاتالوگ',
      'هیچ دسته‌بندی فعالی وجود ندارد.',
    );
  }
  if (snapshot.brands.length === 0) {
    addIssue(issues, 'failure', 'CATALOG_NO_BRANDS', 'کاتالوگ', 'هیچ برند فعالی وجود ندارد.');
  }

  for (const product of snapshot.products) {
    const subject = `محصول ${product.name || product.slug}`;
    requireRealText(issues, product.name, 'PRODUCT_NAME', subject, 'نام محصول');
    requireRealText(issues, product.slug, 'PRODUCT_SLUG', subject, 'slug محصول');
    requireRealText(
      issues,
      product.shortDescription,
      'PRODUCT_SHORT_DESCRIPTION',
      subject,
      'توضیح کوتاه',
      12,
    );
    requireRealText(issues, product.description, 'PRODUCT_DESCRIPTION', subject, 'توضیحات', 30);

    if (!Number.isSafeInteger(product.salePriceToman) || (product.salePriceToman ?? 0) <= 0) {
      addIssue(issues, 'failure', 'PRODUCT_PRICE', subject, 'قیمت فروش معتبر و مثبت نیست.');
    }
    if (
      product.compareAtPriceToman !== null &&
      (product.salePriceToman === null || product.compareAtPriceToman <= product.salePriceToman)
    ) {
      addIssue(
        issues,
        'failure',
        'PRODUCT_COMPARE_PRICE',
        subject,
        'قیمت قبل از تخفیف باید از قیمت فروش بیشتر باشد.',
      );
    }
    if (!product.brandName) {
      addIssue(issues, 'failure', 'PRODUCT_BRAND', subject, 'برند محصول ثبت نشده است.');
    }
    if (!product.countryName) {
      addIssue(issues, 'failure', 'PRODUCT_COUNTRY', subject, 'کشور سازنده محصول ثبت نشده است.');
    }
    if (product.categoryNames.length === 0) {
      addIssue(
        issues,
        'failure',
        'PRODUCT_CATEGORY',
        subject,
        'محصول در هیچ دسته‌بندی فعالی نیست.',
      );
    }
    if (product.mediaCount === 0 || product.primaryMediaCount !== 1) {
      addIssue(
        issues,
        'failure',
        'PRODUCT_MEDIA',
        subject,
        'محصول باید تصویر و دقیقاً یک تصویر اصلی داشته باشد.',
      );
    }
    if (product.variants.length === 0) {
      addIssue(issues, 'failure', 'PRODUCT_VARIANT', subject, 'هیچ واریانت فعالی وجود ندارد.');
    }

    let availableQuantity = 0;
    for (const variant of product.variants) {
      const variantSubject = `${subject} / SKU ${variant.sku}`;
      requireRealText(issues, variant.sku, 'VARIANT_SKU', variantSubject, 'SKU');
      if (/^DEMO-/i.test(variant.sku)) {
        addIssue(
          issues,
          'failure',
          'VARIANT_DEMO_SKU',
          variantSubject,
          'SKU دمو در کاتالوگ فعال است.',
        );
      }
      if (product.sizeMode !== 'NONE') {
        requireRealText(issues, variant.label, 'VARIANT_LABEL', variantSubject, 'عنوان یا سایز');
      }

      const activeInventory = variant.inventory.filter((item) => item.warehouseActive);
      if (activeInventory.length === 0) {
        addIssue(
          issues,
          'failure',
          'VARIANT_INVENTORY_MISSING',
          variantSubject,
          'رکورد موجودی در انبار فعال ندارد.',
        );
      }
      for (const inventory of activeInventory) {
        if (
          inventory.onHand < 0 ||
          inventory.reserved < 0 ||
          inventory.reserved > inventory.onHand
        ) {
          addIssue(
            issues,
            'failure',
            'VARIANT_INVENTORY_INVALID',
            variantSubject,
            `موجودی انبار ${inventory.warehouse} ناسازگار است.`,
          );
        }
        availableQuantity += Math.max(0, inventory.onHand - inventory.reserved);
      }
    }
    if (availableQuantity === 0 && product.variants.length > 0) {
      addIssue(
        issues,
        'warning',
        'PRODUCT_OUT_OF_STOCK',
        subject,
        'تمام واریانت‌ها ناموجود هستند.',
      );
    }
  }

  for (const category of snapshot.categories) {
    const subject = `دسته‌بندی ${category.name || category.slug}`;
    requireRealText(issues, category.name, 'CATEGORY_NAME', subject, 'نام دسته‌بندی');
    requireRealText(issues, category.description, 'CATEGORY_DESCRIPTION', subject, 'توضیحات', 12);
    if (!category.hasImage) {
      addIssue(issues, 'failure', 'CATEGORY_IMAGE', subject, 'تصویر دسته‌بندی ثبت نشده است.');
    }
  }

  for (const brand of snapshot.brands) {
    const subject = `برند ${brand.name || brand.slug}`;
    requireRealText(issues, brand.name, 'BRAND_NAME', subject, 'نام برند');
    requireRealText(issues, brand.description, 'BRAND_DESCRIPTION', subject, 'توضیحات', 12);
    if (!brand.countryName) {
      addIssue(issues, 'failure', 'BRAND_COUNTRY', subject, 'کشور مبدأ برند ثبت نشده است.');
    }
    if (!brand.hasImage) {
      addIssue(issues, 'failure', 'BRAND_IMAGE', subject, 'تصویر برند ثبت نشده است.');
    }
  }

  const settings = snapshot.settings;
  if (!settings.exists || !settings.reviewedByUser) {
    addIssue(
      issues,
      'failure',
      'SITE_SETTINGS_UNREVIEWED',
      'تنظیمات سایت',
      'تنظیمات عملیاتی توسط کاربر مسئول ثبت نشده است.',
    );
  }
  requireRealText(issues, settings.footerAbout, 'FOOTER_ABOUT', 'تنظیمات سایت', 'متن فوتر', 30);
  requireRealText(issues, settings.contactAddress, 'CONTACT_ADDRESS', 'اطلاعات تماس', 'نشانی', 12);
  if (settings.contactPhoneNumbers.length === 0) {
    addIssue(issues, 'failure', 'CONTACT_PHONE', 'اطلاعات تماس', 'شماره تماس ثبت نشده است.');
  }
  for (const phone of settings.contactPhoneNumbers) {
    const digits = normalizePhoneDigits(phone);
    if (digits.length < 8 || digits.length > 14 || DEMO_PHONE_DIGITS.has(digits)) {
      addIssue(
        issues,
        'failure',
        'CONTACT_PHONE_INVALID',
        'اطلاعات تماس',
        `شماره ${phone} واقعی یا معتبر نیست.`,
      );
    }
  }
  if (settings.contactEmail) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail) ||
      containsPlaceholder(settings.contactEmail)
    ) {
      addIssue(issues, 'failure', 'CONTACT_EMAIL_INVALID', 'اطلاعات تماس', 'ایمیل معتبر نیست.');
    }
  } else {
    addIssue(
      issues,
      'warning',
      'CONTACT_EMAIL_MISSING',
      'اطلاعات تماس',
      'ایمیل پشتیبانی ثبت نشده است.',
    );
  }
  if (settings.socialUrls.length === 0) {
    addIssue(
      issues,
      'warning',
      'SOCIAL_LINK_MISSING',
      'اطلاعات تماس',
      'هیچ شبکه اجتماعی ثبت نشده است.',
    );
  }
  for (const url of settings.socialUrls) {
    if (!isValidPublicUrl(url)) {
      addIssue(issues, 'failure', 'SOCIAL_LINK_INVALID', 'اطلاعات تماس', `لینک ${url} معتبر نیست.`);
    }
  }

  const pageByKey = new Map(snapshot.pages.map((page) => [page.key, page]));
  for (const key of CONTENT_PAGE_KEYS) {
    const page = pageByKey.get(key);
    if (!page) {
      addIssue(
        issues,
        'failure',
        'CONTENT_PAGE_MISSING',
        key,
        'صفحه محتوایی در دیتابیس وجود ندارد.',
      );
      continue;
    }

    const subject = `صفحه ${page.title || key}`;
    requireRealText(issues, page.title, 'CONTENT_TITLE', subject, 'عنوان صفحه');
    requireRealText(issues, page.body, 'CONTENT_BODY', subject, 'متن صفحه', 30);
    requireRealText(issues, page.seoTitle, 'CONTENT_SEO_TITLE', subject, 'عنوان SEO', 8);
    requireRealText(
      issues,
      page.seoDescription,
      'CONTENT_SEO_DESCRIPTION',
      subject,
      'توضیحات SEO',
      30,
    );
    if (!page.reviewedByUser) {
      addIssue(
        issues,
        'failure',
        'CONTENT_UNREVIEWED',
        subject,
        'صفحه توسط کاربر مسئول ثبت یا بازبینی نشده است.',
      );
    }
    if (key === 'FAQ' && page.sectionCount === 0) {
      addIssue(issues, 'failure', 'FAQ_EMPTY', subject, 'سوالات متداول خالی است.');
    }
  }

  for (const media of snapshot.media) {
    requireRealText(issues, media.storageKey, 'MEDIA_STORAGE_KEY', media.subject, 'کلید فایل');
    requireRealText(issues, media.altText, 'MEDIA_ALT', media.subject, 'متن جایگزین', 3);
    if (media.deleted) {
      addIssue(
        issues,
        'failure',
        'MEDIA_DELETED',
        media.subject,
        'رسانه حذف‌شده هنوز استفاده می‌شود.',
      );
    }
    if (!IMAGE_MIME_TYPES.has(media.mimeType)) {
      addIssue(
        issues,
        'failure',
        'MEDIA_MIME',
        media.subject,
        `نوع فایل ${media.mimeType} پشتیبانی نمی‌شود.`,
      );
    }
    if (
      media.sizeBytes <= 0 ||
      !media.width ||
      media.width <= 0 ||
      !media.height ||
      media.height <= 0
    ) {
      addIssue(
        issues,
        'failure',
        'MEDIA_METADATA',
        media.subject,
        'اندازه یا ابعاد تصویر معتبر نیست.',
      );
    }
  }

  return issues;
}
