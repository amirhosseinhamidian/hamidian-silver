import {
  containsPlaceholder,
  type ContentAuditSnapshot,
  isValidPublicUrl,
  validateProductionContent,
} from './production-content-audit.rules';

const PAGE_KEYS = [
  'ABOUT',
  'CONTACT',
  'SERVICES',
  'TERMS',
  'PRIVACY',
  'SIZE_GUIDE',
  'FAQ',
] as const;

function validSnapshot(): ContentAuditSnapshot {
  return {
    products: [
      {
        name: 'انگشتر نقره ماه',
        slug: 'silver-ring-mah',
        shortDescription: 'انگشتر نقره با پرداخت دستی و طراحی مینیمال.',
        description:
          'این انگشتر از نقره ساخته شده و مشخصات، وزن و شرایط نگهداری آن پیش از خرید بررسی می‌شود.',
        salePriceToman: 4_800_000,
        compareAtPriceToman: 5_200_000,
        sizeMode: 'SIZED',
        brandName: 'نقره حمیدیان',
        countryName: 'ایران',
        categoryNames: ['انگشتر'],
        mediaCount: 1,
        primaryMediaCount: 1,
        variants: [
          {
            sku: 'HS-RING-MAH-54',
            label: '۵۴',
            inventory: [
              {
                warehouse: 'انبار اصلی',
                warehouseActive: true,
                onHand: 5,
                reserved: 1,
              },
            ],
          },
        ],
      },
    ],
    categories: [
      {
        name: 'انگشتر',
        slug: 'rings',
        description: 'مجموعه انگشترهای نقره با مشخصات کامل.',
        hasImage: true,
      },
    ],
    brands: [
      {
        name: 'نقره حمیدیان',
        slug: 'hamidian-silver',
        description: 'طراحی و عرضه زیورآلات نقره با اصالت مشخص.',
        countryName: 'ایران',
        hasImage: true,
      },
    ],
    settings: {
      exists: true,
      reviewedByUser: true,
      footerAbout: 'گالری نقره حمیدیان؛ همراه شما برای انتخاب زیورآلات اصیل و ماندگار.',
      contactAddress: 'تبریز، خیابان اصلی، پلاک ۱۲',
      contactPhoneNumbers: ['04135551234'],
      contactEmail: 'support@hamidiansilver.ir',
      socialUrls: ['https://ble.ir/hamidiansilver'],
    },
    pages: PAGE_KEYS.map((key) => ({
      key,
      title: `عنوان صفحه ${key}`,
      body: 'متن کامل و بازبینی‌شده این صفحه شامل اطلاعات لازم برای مشتریان فروشگاه است.',
      sectionCount: key === 'FAQ' ? 5 : 0,
      seoTitle: `عنوان بهینه صفحه ${key}`,
      seoDescription:
        'توضیحات کامل و اختصاصی این صفحه برای نمایش درست در نتیجه جستجو نوشته شده است.',
      reviewedByUser: true,
    })),
    media: [
      {
        id: 'media-1',
        subject: 'تصویر محصول انگشتر نقره ماه',
        storageKey: 'catalog/2026/09/ring.webp',
        mimeType: 'image/webp',
        sizeBytes: 48_000,
        width: 1200,
        height: 1200,
        altText: 'انگشتر نقره ماه',
        deleted: false,
      },
    ],
  };
}

describe('production content audit rules', () => {
  it('accepts complete production content', () => {
    expect(validateProductionContent(validSnapshot())).toEqual([]);
  });

  it('detects demo products, invalid prices, and inconsistent inventory', () => {
    const snapshot = validSnapshot();
    const product = snapshot.products[0];
    const issues = validateProductionContent({
      ...snapshot,
      products: [
        {
          ...product,
          compareAtPriceToman: product.salePriceToman,
          variants: [
            {
              sku: 'DEMO-RING-54',
              label: '۵۴',
              inventory: [
                {
                  warehouse: 'انبار اصلی',
                  warehouseActive: true,
                  onHand: 1,
                  reserved: 2,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'PRODUCT_COMPARE_PRICE',
        'VARIANT_DEMO_SKU',
        'VARIANT_INVENTORY_INVALID',
        'PRODUCT_OUT_OF_STOCK',
      ]),
    );
  });

  it('rejects placeholder contact data and missing reviewed content', () => {
    const snapshot = validSnapshot();
    const issues = validateProductionContent({
      ...snapshot,
      settings: {
        ...snapshot.settings,
        reviewedByUser: false,
        contactAddress: 'تهران، نشانی واقعی فروشگاه',
        contactPhoneNumbers: ['09123456789'],
      },
      pages: snapshot.pages.filter(({ key }) => key !== 'TERMS'),
    });

    expect(issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'SITE_SETTINGS_UNREVIEWED',
        'CONTACT_ADDRESS_PLACEHOLDER',
        'CONTACT_PHONE_INVALID',
        'CONTENT_PAGE_MISSING',
      ]),
    );
  });

  it('rejects missing media metadata and unsafe public URLs', () => {
    const snapshot = validSnapshot();
    const issues = validateProductionContent({
      ...snapshot,
      media: [
        {
          ...snapshot.media[0],
          mimeType: 'image/svg+xml',
          width: null,
          altText: null,
          deleted: true,
        },
      ],
    });

    expect(issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['MEDIA_ALT', 'MEDIA_DELETED', 'MEDIA_MIME', 'MEDIA_METADATA']),
    );
    expect(isValidPublicUrl('https://social.example.com/hamidian')).toBe(false);
    expect(isValidPublicUrl('https://ble.ir/hamidiansilver')).toBe(true);
    expect(containsPlaceholder('مجموعه فرضی برای تست رابط فروشگاه')).toBe(true);
  });
});
