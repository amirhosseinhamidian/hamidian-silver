import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 4311;
const STOREFRONT_ORIGIN = 'http://localhost:4310';
const MOCK_API_ORIGIN = 'http://127.0.0.1:4311';
const ACCESS_TOKEN = 'e2e-access-token';
const OTP_CODE = '12345';
const PHONE = '09123456789';
const ORDER_ID = '30000000-0000-4000-8000-000000000001';
const ATTEMPT_ID = '40000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const VARIANT_ID = '20000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '50000000-0000-4000-8000-000000000001';
const SHIPPING_CARRIER_ID = '90000000-0000-4000-8000-000000000001';
const CREATED_AT = '2026-09-11T08:00:00.000Z';
const PAID_AT = '2026-09-11T08:02:00.000Z';

let paymentConfirmed = false;
let orderCreatedAt = CREATED_AT;
let paymentConfirmedAt = PAID_AT;
let orderCreated = false;
let receiptSubmitted = false;
let apiUnavailable = false;
let campaignPlacements = false;
let festivalHeader = null;
const measuredStages = new Set();

const media = {
  url: `${MOCK_API_ORIGIN}/media/silver-ring.png`,
  altText: 'انگشتر نقره حمیدیان',
  width: 64,
  height: 64,
  mimeType: 'image/png',
};

const product = {
  id: PRODUCT_ID,
  name: 'انگشتر نقره حمیدیان',
  slug: 'silver-ring',
  shortDescription: 'انگشتر نقره برای آزمون کامل فرایند خرید.',
  description: 'محصول کنترل‌شده تست E2E.',
  seoCanonicalPath: '/products/silver-ring',
  seoNoIndex: true,
  seoTitle: null,
  seoDescription: null,
  seoOgMedia: null,
  salePriceToman: 800_000,
  compareAtPriceToman: 1_000_000,
  sizeMode: 'NONE',
  brand: null,
  categories: [],
  primaryMedia: media,
  availableQuantity: 3,
  isAvailable: true,
  country: null,
  media: [media],
  variants: [
    {
      id: VARIANT_ID,
      name: null,
      weightGrams: 4.25,
      size: null,
      platingOptions: [],
      availableQuantity: 3,
      isAvailable: true,
    },
  ],
  attributes: [],
};

const seoProduct = {
  ...product,
  id: '10000000-0000-4000-8000-000000000002',
  slug: 'athena-gold-silver-chain-45cm-model-2',
  name: 'زنجیر نقره آتنا',
  seoCanonicalPath: null,
  seoNoIndex: false,
};

const catalogCategory = {
  id: 'a0000000-0000-4000-8000-000000000006',
  name: 'انگشتر',
  slug: 'rings',
  parentId: null,
  sortOrder: 1,
  hasProducts: true,
  activeProductCount: 1,
  activeSubtreeProductCount: 2,
};

const catalogChildCategory = {
  ...catalogCategory,
  id: 'a0000000-0000-4000-8000-000000000008',
  name: 'انگشتر زنانه',
  slug: 'women-rings',
  description: 'برای انتخاب انگشتر زنانه، پهنای حلقه و سایز مدلی را که راحت می‌پوشید مقایسه کنید.',
  seoTitle: 'راهنمای انتخاب انگشتر زنانه نقره',
  seoCanonicalPath: '/categories/women-rings',
  parentId: catalogCategory.id,
  activeSubtreeProductCount: 1,
};

const catalogBrand = {
  id: 'a0000000-0000-4000-8000-000000000007',
  name: 'برند نمونه',
  slug: 'sample',
  seoCanonicalPath: '/brands/sample',
};

const atelierBrand = { id: 'a0000000-0000-4000-8000-000000000009', name: 'آتلیه', slug: 'atelier' };
const soldOutProduct = {
  ...product,
  id: '10000000-0000-4000-8000-000000000003',
  name: 'انگشتر ناموجود نمونه',
  slug: 'sold-out-ring',
  seoCanonicalPath: null,
  seoNoIndex: false,
  brand: catalogBrand,
  categories: [catalogChildCategory],
  salePriceToman: 800_000,
  compareAtPriceToman: null,
  availableQuantity: 0,
  isAvailable: false,
  variants: [{ ...product.variants[0], availableQuantity: 0, isAvailable: false }],
};
const facetProducts = [
  {
    item: { ...product, brand: catalogBrand, categories: [catalogChildCategory] },
    weight: 4.25,
    audience: 'women',
    occasion: 'birthday',
    style: 'minimal',
    country: 'italy',
  },
  {
    item: {
      ...seoProduct,
      brand: atelierBrand,
      categories: [catalogCategory],
      salePriceToman: 1_200_000,
    },
    weight: 6.5,
    audience: 'men',
    occasion: 'anniversary',
    style: 'classic',
  },
  {
    item: { ...soldOutProduct, salePriceToman: null },
    weight: null,
    audience: 'women',
    occasion: 'birthday',
    style: 'minimal',
  },
];

const giftAttributeFixtures = [
  {
    key: 'occasion',
    code: 'gift-occasion',
    label: 'مناسبت',
    values: [
      { value: 'birthday', label: 'تولد' },
      { value: 'anniversary', label: 'سالگرد' },
    ],
  },
  {
    key: 'style',
    code: 'gift-style',
    label: 'سبک',
    values: [
      { value: 'minimal', label: 'مینیمال' },
      { value: 'classic', label: 'کلاسیک' },
    ],
  },
];

function facetedProducts(query) {
  const matches = (omit) =>
    facetProducts.filter((record) => {
      const { item, weight, audience, country } = record;
      const categories = item.categories.map(({ slug }) => slug);
      if (categories.includes('women-rings')) categories.push('rings');
      if (query.scopeCategory && !categories.includes(query.scopeCategory)) return false;
      if (query.scopeBrand && query.scopeBrand !== item.brand.slug) return false;
      if (query.scopeCountry && query.scopeCountry !== country) return false;
      if (query.q && !item.name.includes(query.q)) return false;
      if (
        omit !== 'category' &&
        query.categories?.length &&
        !query.categories.some((value) => categories.includes(value))
      )
        return false;
      if (omit !== 'brand' && query.brands?.length && !query.brands.includes(item.brand.slug))
        return false;
      if (
        omit !== 'availability' &&
        query.availability &&
        (query.availability === 'in-stock') !== item.isAvailable
      )
        return false;
      if (
        omit !== 'price' &&
        ((query.minPriceToman != null && (item.salePriceToman ?? 0) < query.minPriceToman) ||
          (query.maxPriceToman != null &&
            (item.salePriceToman == null || item.salePriceToman > query.maxPriceToman)))
      )
        return false;
      if (
        omit !== 'weight' &&
        ((query.minWeightGrams != null && (weight ?? 0) < query.minWeightGrams) ||
          (query.maxWeightGrams != null && (weight == null || weight > query.maxWeightGrams)))
      )
        return false;
      if (
        omit !== 'intended-for' &&
        query.attributes?.some(
          ({ code, values }) => code === 'intended-for' && !values?.includes(audience),
        )
      )
        return false;
      if (
        query.attributes?.some(({ code, values }) =>
          giftAttributeFixtures.some(
            (fixture) =>
              fixture.code === code && omit !== code && !values?.includes(record[fixture.key]),
          ),
        )
      )
        return false;
      return true;
    });
  const options = (values, records, applies) =>
    values.flatMap(({ value, label }) => {
      const count = records.filter((record) => applies(record, value)).length;
      return count ? [{ value, label, count }] : [];
    });
  const range = (records, value) => {
    const numbers = records.map(value).filter((item) => item != null);
    return numbers.length
      ? { min: Math.min(...numbers), max: Math.max(...numbers), count: numbers.length }
      : null;
  };
  const audience = options(
    [
      { value: 'women', label: 'بانوان' },
      { value: 'men', label: 'آقایان' },
    ],
    matches('intended-for'),
    (record, value) => record.audience === value,
  );
  const facets = {
    categories: options(
      [catalogCategory, catalogChildCategory].map(({ slug, name }) => ({
        value: slug,
        label: name,
      })),
      matches('category'),
      ({ item }, value) =>
        item.categories.some(
          ({ slug }) => slug === value || (value === 'rings' && slug === 'women-rings'),
        ),
    ),
    brands: options(
      [catalogBrand, atelierBrand].map(({ slug, name }) => ({ value: slug, label: name })),
      matches('brand'),
      ({ item }, value) => item.brand.slug === value,
    ),
    availability: options(
      [
        { value: 'in-stock', label: 'موجود' },
        { value: 'out-of-stock', label: 'ناموجود' },
      ],
      matches('availability'),
      ({ item }, value) => item.isAvailable === (value === 'in-stock'),
    ),
    sizes: [],
    priceToman: range(matches('price'), ({ item }) => item.salePriceToman),
    weightGrams: range(matches('weight'), ({ weight }) => weight),
    lengthMm: null,
    attributes: audience.length
      ? [
          {
            code: 'intended-for',
            label: 'قابل استفاده برای',
            kind: 'MULTI_SELECT',
            unit: 'NONE',
            options: audience,
            range: null,
          },
        ]
      : [],
  };
  for (const fixture of giftAttributeFixtures) {
    const available = options(
      fixture.values,
      matches(fixture.code),
      (record, value) => record[fixture.key] === value,
    );
    if (available.length)
      facets.attributes.push({
        code: fixture.code,
        label: fixture.label,
        kind: 'SELECT',
        unit: 'NONE',
        options: available,
        range: null,
      });
  }
  const { page = 1, pageSize = 24 } = query;
  const items = matches().map(({ item }) =>
    query.sort === 'featured' && query.minPriceToman === 1 && item.slug === 'silver-ring'
      ? { ...item, defaultSalePriceToman: 1_200_000 }
      : item,
  );
  const ranking =
    query.sort === 'best-selling'
      ? { version: 1, requestedSort: 'best-selling', appliedSort: 'newest' }
      : undefined;
  // Preserve the two-page fixture used by catalog navigation tests.
  if (
    !query.q &&
    !query.scopeCountry &&
    !query.availability &&
    !query.categories?.length &&
    !query.brands?.length &&
    !query.attributes?.length &&
    query.minPriceToman == null &&
    query.maxPriceToman == null &&
    query.minWeightGrams == null &&
    query.maxWeightGrams == null &&
    items.length > 1
  ) {
    return {
      items: page <= 2 ? items.slice(page - 1, page) : [],
      page,
      pageSize,
      total: pageSize + 1,
      totalPages: 2,
      facets,
      ...(ranking ? { ranking } : {}),
    };
  }
  if (query.sort === 'price-asc' || query.sort === 'price-desc') {
    const direction = query.sort === 'price-desc' ? -1 : 1;
    items.sort(
      (left, right) =>
        Number(right.isAvailable) - Number(left.isAvailable) ||
        ((left.salePriceToman ?? 0) - (right.salePriceToman ?? 0)) * direction,
    );
  }
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    facets,
    ...(ranking ? { ranking } : {}),
  };
}

const guideTopic = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'نگهداری نقره',
  slug: 'silver-care',
  description: 'پاسخ‌های کاربردی برای مراقبت بهتر از نقره',
  coverMedia: null,
};

const guideSummary = {
  id: 'a0000000-0000-4000-8000-000000000002',
  title: 'راهنمای نگهداری نقره',
  slug: 'silver-care',
  eyebrow: 'مراقبت روزمره',
  excerpt: 'روش‌های ساده و امن برای تمیز نگه‌داشتن زیورآلات نقره.',
  format: 'CARE_GUIDE',
  status: 'PUBLISHED',
  heroMedia: null,
  cardMedia: null,
  seoCanonicalPath: '/guide/silver-care',
  seoNoIndex: false,
  seoOgMedia: null,
  readingTimeMinutes: 4,
  isFeatured: true,
  blockCount: 2,
  publishedAt: CREATED_AT,
  topics: [guideTopic],
  version: 1,
  updatedAt: PAID_AT,
};

const relatedGuideSummary = {
  ...guideSummary,
  id: 'a0000000-0000-4000-8000-000000000003',
  title: 'چطور نقره اصل را تشخیص دهیم؟',
  slug: 'recognize-real-silver',
  eyebrow: 'پاسخ روشن',
  format: 'ANSWER',
  isFeatured: false,
};

const guideArticle = {
  ...guideSummary,
  heroMobileMedia: null,
  productRecommendationMode: 'MANUAL',
  seoTitle: null,
  seoDescription: null,
  searchKeywords: ['نگهداری نقره', 'تمیز کردن نقره'],
  blocks: [
    {
      id: 'a0000000-0000-4000-8000-000000000004',
      type: 'LEAD',
      variant: null,
      anchorId: 'summary',
      primaryMedia: null,
      content: {
        heading: 'چرا مراقبت درست مهم است؟',
        body: 'با چند عادت ساده می‌توان درخشش نقره را برای مدت بیشتری حفظ کرد.',
      },
      sortOrder: 0,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000005',
      type: 'FAQ',
      variant: 'accordion',
      anchorId: 'questions',
      primaryMedia: null,
      content: {
        heading: 'پرسش‌های رایج',
        items: [{ question: 'نقره را کجا نگهداری کنیم؟', answer: 'در محیط خشک و دور از رطوبت.' }],
      },
      sortOrder: 1,
    },
  ],
  relatedProducts: [
    {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      salePriceToman: product.salePriceToman,
      primaryMedia: product.primaryMedia,
    },
  ],
  relatedCategories: [catalogCategory],
  relatedBrands: [catalogBrand],
  relatedArticles: [relatedGuideSummary],
  createdAt: CREATED_AT,
};

const address = {
  id: ADDRESS_ID,
  title: 'خانه',
  recipientName: 'خریدار آزمایشی',
  phone: PHONE,
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان آزمایش، پلاک ۱',
  postalCode: '1234567890',
  isDefault: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

function order() {
  const status = paymentConfirmed ? 'PAID' : 'PENDING_PAYMENT';
  return {
    id: ORDER_ID,
    orderNumber: 'HS-E2E-1001',
    status,
    trackingCode: null,
    paidAt: paymentConfirmed ? paymentConfirmedAt : null,
    cancelledAt: null,
    deliveredAt: null,
    merchandiseTotalToman: 800_000,
    platingTotalToman: 0,
    discountTotalToman: 0,
    shippingTotalToman: 0,
    taxTotalToman: 0,
    grandTotalToman: 800_000,
    returnAuthorized: false,
    reservationExpiresAt: '2026-09-11T08:30:00.000Z',
    createdAt: orderCreatedAt,
    updatedAt: paymentConfirmed ? paymentConfirmedAt : orderCreatedAt,
    payment: receiptSubmitted
      ? {
          status: paymentConfirmed ? 'PAID' : 'AWAITING_REVIEW',
          method: 'CARD_TO_CARD',
          receiptAvailable: true,
          receiptOriginalName: 'receipt.png',
          receiptUploadedAt: PAID_AT,
        }
      : null,
    items: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        variantId: VARIANT_ID,
        quantity: 1,
        productNameSnapshot: product.name,
        productSlug: product.slug,
        skuSnapshot: 'RING-E2E-001',
        primaryMedia: media,
        variantNameSnapshot: null,
        sizeLabelSnapshot: null,
        platingType: null,
        platingWeightGrams: null,
        platingRateToman: null,
        platingLeadTimeDays: null,
        unitWeightGrams: '4.25',
        unitSalePriceToman: 800_000,
        unitPlatingPriceToman: 0,
        lineTotalToman: 800_000,
        returnableQuantity: 0,
        createdAt: CREATED_AT,
      },
    ],
    shippingAddress: {
      recipientName: address.recipientName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
    },
    statusHistory: paymentConfirmed
      ? [
          { fromStatus: null, toStatus: 'PENDING_PAYMENT', createdAt: orderCreatedAt },
          { fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID', createdAt: paymentConfirmedAt },
        ]
      : [{ fromStatus: null, toStatus: 'PENDING_PAYMENT', createdAt: orderCreatedAt }],
  };
}

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function authenticated(request) {
  return request.headers.authorization === `Bearer ${ACCESS_TOKEN}`;
}

function requireAuthentication(request, response) {
  if (authenticated(request)) return true;
  json(response, 401, { message: 'Authentication required.' });
  return false;
}

function gateway(response, attemptId) {
  const callback = new URL(`/api/payment/callback/${attemptId}`, STOREFRONT_ORIGIN);
  callback.searchParams.set('Authority', 'E2E-AUTHORITY');
  callback.searchParams.set('Status', 'OK');

  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(`<!doctype html>
<html lang="fa" dir="rtl">
  <head><meta charset="utf-8"><title>درگاه آزمایشی پرداخت</title></head>
  <body>
    <main>
      <h1>درگاه آزمایشی پرداخت</h1>
      <p>این صفحه فقط در تست محلی Playwright اجرا می‌شود.</p>
      <a href="${callback.toString()}">تأیید پرداخت کم‌مبلغ</a>
    </main>
  </body>
</html>`);
}

async function handler(request, response) {
  const url = new URL(request.url ?? '/', MOCK_API_ORIGIN);

  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, { status: 'ok' });
  }

  if (request.method === 'POST' && url.pathname === '/__e2e/reset') {
    paymentConfirmed = false;
    orderCreatedAt = CREATED_AT;
    paymentConfirmedAt = PAID_AT;
    orderCreated = false;
    receiptSubmitted = false;
    apiUnavailable = false;
    campaignPlacements = false;
    festivalHeader = null;
    measuredStages.clear();
    return json(response, 200, { reset: true });
  }

  if (request.method === 'POST' && url.pathname === '/__e2e/campaign-placements') {
    campaignPlacements = Boolean((await body(request)).enabled);
    return json(response, 200, { campaignPlacements });
  }

  if (request.method === 'POST' && url.pathname === '/__e2e/festival-header') {
    const { state, showCountdown } = await body(request);
    festivalHeader = state
      ? {
          state,
          showCountdown: showCountdown !== false,
          endsAt: festivalHeader?.endsAt ?? new Date(Date.now() + 5 * 60_000).toISOString(),
          countdownEndsAt:
            festivalHeader?.countdownEndsAt ?? new Date(Date.now() + 130 * 60_000).toISOString(),
        }
      : null;
    return json(response, 200, { festivalHeader });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/campaigns/public/sitemap') {
    return json(response, 200, {
      entries: campaignPlacements ? [{ slug: 'nowruz', updatedAt: CREATED_AT }] : [],
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/campaigns/public/activity') {
    return json(response, 200, {
      activeIds: [
        'festival-nowruz',
        ...(festivalHeader?.state === 'active' ? ['festival-header'] : []),
      ],
    });
  }

  if (
    request.method === 'GET' &&
    ['/api/v1/campaigns/public/banner', '/api/v1/campaigns/public/placement'].includes(url.pathname)
  ) {
    const slug = url.searchParams.get('slug');
    const slot = url.searchParams.get('slot');
    if (slot === 'NAVIGATION' || slot === 'COUNTDOWN') {
      return json(response, 200, {
        banner:
          festivalHeader?.state === 'active'
            ? {
                campaignId: 'festival-header',
                name: 'جشنوارهٔ آزمایشی',
                message: 'پیشنهاد ویژهٔ جشنواره',
                ctaPath: slot === 'COUNTDOWN' ? '/products' : '/campaigns/festival-nowruz',
                ctaLabel: 'دیدن پیشنهادها',
                media: null,
                endsAt: festivalHeader.endsAt,
                countdownEndsAt: festivalHeader.countdownEndsAt,
                textColor: '#fff5dc',
                display: {
                  title: 'پیشنهاد نوروز',
                  backgroundColor: '#20162e',
                  gradientColor: '#50385d',
                  motion: 'EMPHASIS',
                  icon: 'STAR',
                  ctaStyle: 'SOLID',
                  showCountdown: festivalHeader.showCountdown,
                },
              }
            : null,
      });
    }
    const matches =
      url.pathname.endsWith('/banner') ||
      (slot === 'CATEGORY' && slug === 'rings') ||
      (slot === 'PRODUCT' && slug === 'silver-ring');
    return json(response, 200, {
      banner:
        campaignPlacements && matches
          ? {
              name: 'کمپین نوروز',
              message: 'مجموعهٔ نوروزی',
              ctaPath: '/campaigns/nowruz',
              ctaLabel: 'دیدن مجموعه',
              endsAt: '2099-03-22T12:00:00.000Z',
              media: { ...media, id: PRODUCT_ID },
            }
          : null,
    });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/campaigns/public/landing/')) {
    const slug = url.pathname.split('/').at(-1);
    const page = Number(url.searchParams.get('page') ?? '1');
    const festival = slug === 'festival-nowruz';
    if (
      !['nowruz', 'festival-nowruz', 'weekend', 'archived-nowruz', 'empty-collection'].includes(
        slug,
      ) ||
      page > (slug === 'nowruz' || festival ? 2 : 1)
    ) {
      return json(response, 404, { message: 'Campaign landing not found.' });
    }
    const hasProducts = slug !== 'archived-nowruz' && slug !== 'empty-collection';
    const count = hasProducts ? (slug === 'nowruz' || festival ? 2 : 1) : 0;
    const artwork = {
      media: { ...media, id: PRODUCT_ID, altText: 'تصویر مزایای جشنواره' },
      mobileMedia: null,
      stillMedia: null,
    };
    const endsAt = '2099-03-22T12:00:00.000Z';
    const festivalRing = {
      ...product,
      campaignOffer: {
        campaignId: slug,
        name: 'جشنوارهٔ نوروز',
        endsAt,
        conditions: [],
        minimumToman: null,
        price: {
          regularToman: 800_000,
          discountToman: 80_000,
          finalToman: 720_000,
          discountPercent: 10,
        },
      },
      campaignQuota: {
        campaignId: slug,
        name: 'جشنوارهٔ نوروز',
        endsAt,
        limit: 5,
        sold: 2,
        remaining: 3,
      },
    };
    return json(response, 200, {
      slug,
      title: slug === 'nowruz' ? 'مجموعهٔ نوروز' : 'مجموعهٔ آزمایشی',
      story: 'انتخاب‌هایی برای هدیه دادن.',
      seoMode: slug === 'weekend' ? 'TEMPORARY' : 'RECURRING',
      isFestival: festival,
      ...(festival && !url.searchParams.has('productsOnly')
        ? {
            campaignId: slug,
            endsAt,
            design: {
              theme: {
                background: '#16131b',
                surface: '#2c2434',
                foreground: '#ffffff',
                accent: '#f0acd6',
                decoration: 'NONE',
                motion: 'STILL',
                card: {
                  surface: '#21162d',
                  border: '#f0acd6',
                  discount: '#ffc8ea',
                  tag: '#ffd49a',
                  price: '#ffdda8',
                  quota: '#9ed0c0',
                  action: '#d0b9ff',
                  density: 'COMPACT',
                  shadow: 'SOFT',
                  showDescription: false,
                  hoverEmphasis: false,
                },
              },
              filterCategories: [{ label: 'انگشتر', value: 'rings', count: 2 }],
              filterBrands: [],
              sections: [
                {
                  kind: 'HIGHLIGHTS',
                  title: 'مزایای جشنواره',
                  description: 'راهنمای خرید در جشنواره',
                  highlighted: true,
                  artwork,
                  layout: 'GRID',
                },
                { kind: 'PICKS', title: 'منتخب جشنواره', layout: 'GRID', products: [festivalRing] },
                { kind: 'PRODUCTS', title: 'همهٔ محصولات جشنواره', layout: 'GRID' },
              ],
            },
          }
        : {}),
      active: slug !== 'archived-nowruz',
      media: { ...media, id: PRODUCT_ID },
      ctaPath: '/products',
      ctaLabel: 'دیدن همهٔ محصولات',
      products: {
        total: count,
        page,
        pageSize: 1,
        totalPages: count,
        items: hasProducts ? [page === 1 ? (festival ? festivalRing : product) : seoProduct] : [],
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/__e2e/measurement-stages') {
    return json(response, 200, [...measuredStages]);
  }

  if (request.method === 'POST' && url.pathname === '/__e2e/approve-receipt') {
    if (!receiptSubmitted) return json(response, 409, { message: 'No receipt to approve.' });
    if (!paymentConfirmed) paymentConfirmedAt = new Date().toISOString();
    paymentConfirmed = true;
    return json(response, 200, { paymentConfirmed });
  }

  if (request.method === 'POST' && url.pathname === '/__e2e/api-unavailable') {
    apiUnavailable = Boolean((await body(request)).enabled);
    return json(response, 200, { apiUnavailable });
  }

  if (apiUnavailable && url.pathname.startsWith('/api/v1/')) {
    return json(response, 503, { message: 'Mock API is unavailable.' });
  }

  if (request.method === 'GET' && url.pathname === '/media/silver-ring.png') {
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURejl4f///9E5aMAAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gkLFAI3ML67FQAAAA9JREFUKM9jYBgFo4B8AAACQAABjMWrdwAAAABJRU5ErkJggg==',
      'base64',
    );
    response.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    });
    return response.end(pixel);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/site-settings/public') {
    return json(response, 200, {
      headerCategories: [],
      announcement: {
        enabled: false,
        message: null,
        countdownMode: 'NONE',
        durationSeconds: null,
        endsAt: null,
        ctaLabel: null,
        ctaHref: null,
      },
      catalogHeroEnabled: false,
      catalogHeroTitle: null,
      catalogHeroSubtitle: null,
      catalogHeroMedia: null,
      galleryName: 'نقره حمیدیان',
      footerAbout: null,
      contactAddress: null,
      contactPhoneNumbers: [],
      contactEmail: null,
      instagramUrl: null,
      telegramUrl: null,
      baleUrl: null,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/site-settings/public/pages/PRIVACY') {
    return json(response, 200, {
      key: 'PRIVACY',
      title: 'حریم خصوصی',
      eyebrow: null,
      subtitle: null,
      body: null,
      sections: [],
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/site-settings/public/homepage') {
    return json(response, 200, {
      primaryHeroSlides: campaignPlacements
        ? [
            {
              title: 'جشنوارهٔ نوروز',
              subtitle: null,
              actionHref: '/campaigns/nowruz',
              actionLabel: 'مشاهدهٔ جشنواره',
              contentColor: '#FFFFFF',
              media,
              mobileMedia: null,
            },
          ]
        : [],
      secondaryHero: null,
      newProducts: [product],
      featuredCategories: [],
      popularProducts: [],
      featuredBrands: [],
      manufacturerCountriesEnabled: false,
      manufacturerCountries: [],
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/shipping/pricing/public') {
    return json(response, 200, {
      mode: 'FREE',
      baseCostToman: 0,
      thresholdToman: null,
      discountedCostToman: null,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/shipping/options/public') {
    return json(response, 200, [
      {
        id: SHIPPING_CARRIER_ID,
        name: 'پست پیشتاز',
        subtitle: 'ارسال اقتصادی با پوشش سراسری کشور',
        logo: null,
        pricingMode: 'FREE',
        baseCostToman: 0,
        thresholdToman: null,
        discountedCostToman: null,
        serviceArea: 'NATIONWIDE',
      },
    ]);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/public/categories') {
    return json(response, 200, [catalogCategory, catalogChildCategory]);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/seo/sitemap') {
    const entity = ({ id, slug, seoCanonicalPath, seoNoIndex }) => ({
      id,
      slug,
      seoCanonicalPath: seoCanonicalPath ?? null,
      seoNoIndex: seoNoIndex ?? false,
      updatedAt: CREATED_AT,
      imageUrl: null,
    });
    return json(response, 200, {
      products: facetProducts.map(({ item }) => ({
        ...entity(item),
        brandId: item.brand.id,
        categoryIds: item.categories.map(({ id }) => id),
      })),
      categories: [catalogCategory, catalogChildCategory].map((category) => ({
        ...entity(category),
        parentId: category.parentId,
      })),
      brands: [catalogBrand, atelierBrand].map(entity),
      contentPages: [],
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/seo/redirects/resolve') {
    if (url.searchParams.get('path') === '/categories/rings-legacy') {
      return json(response, 200, { destinationPath: '/categories/rings', permanent: true });
    }
    return json(response, 404, { message: 'SEO redirect was not found.' });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/public/brands') {
    return json(response, 200, [catalogBrand, atelierBrand]);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/public/products') {
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '24');
    return json(response, 200, {
      items: page === 1 ? [product] : page === 2 ? [seoProduct] : [],
      page,
      pageSize,
      total: pageSize + 1,
      totalPages: 2,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/catalog/public/search/facets') {
    return json(response, 200, facetedProducts(await body(request)));
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/growth-attribution/measurement') {
    const measurement = await body(request);
    if (typeof measurement?.stage !== 'string') {
      return json(response, 400, { message: 'A measurement stage is required.' });
    }
    measuredStages.add(measurement.stage);
    response.writeHead(204);
    return response.end();
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/public/products/silver-ring') {
    return json(response, 200, product);
  }

  if (
    request.method === 'GET' &&
    url.pathname === '/api/v1/catalog/public/products/sold-out-ring'
  ) {
    return json(response, 200, soldOutProduct);
  }

  if (
    request.method === 'GET' &&
    url.pathname === `/api/v1/catalog/public/products/${seoProduct.slug}`
  ) {
    return json(response, 200, seoProduct);
  }

  if (
    request.method === 'GET' &&
    (url.pathname === '/api/v1/catalog/public/products/silver-ring/related' ||
      url.pathname === '/api/v1/catalog/public/products/sold-out-ring/related' ||
      url.pathname === `/api/v1/catalog/public/products/${seoProduct.slug}/related`)
  ) {
    const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '8', 10);

    return json(response, 200, {
      items: [],
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/guide/public/topics') {
    return json(response, 200, [guideTopic]);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/guide/public/articles') {
    const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
    const items = url.searchParams.has('q') ? [] : [guideSummary, relatedGuideSummary];
    return json(response, 200, {
      items,
      page,
      limit,
      total: items.length,
      totalPages: items.length ? 1 : 0,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/guide/public/articles/silver-care') {
    return json(response, 200, guideArticle);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/guide/public/related-articles') {
    return json(response, 200, [guideSummary]);
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/otp/request') {
    const payload = await body(request);
    if (payload.phone !== PHONE) return json(response, 400, { message: 'Invalid test phone.' });
    return json(response, 202, {
      challengeId: '70000000-0000-4000-8000-000000000001',
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/otp/verify') {
    const payload = await body(request);
    if (payload.phone !== PHONE || payload.code !== OTP_CODE) {
      return json(response, 401, { message: 'Invalid test OTP.' });
    }
    return json(response, 200, {
      tokenType: 'Bearer',
      accessToken: ACCESS_TOKEN,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: '80000000-0000-4000-8000-000000000001', phone: PHONE },
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/auth/me') {
    if (!requireAuthentication(request, response)) return;
    return json(response, 200, {
      id: '80000000-0000-4000-8000-000000000001',
      phone: PHONE,
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/profile/addresses') {
    if (!requireAuthentication(request, response)) return;
    return json(response, 200, [address]);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/payments/card-to-card/settings') {
    if (!requireAuthentication(request, response)) return;
    return json(response, 200, {
      enabled: true,
      cardNumber: '6037991234567890',
      ibanNumber: '820540102680020817909002',
      holderName: 'گالری حمدیان',
      bankName: 'بانک ملی',
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/orders') {
    if (!requireAuthentication(request, response)) return;
    const payload = await body(request);
    const item = payload.items?.[0];
    if (
      payload.userAddressId !== ADDRESS_ID ||
      payload.shippingCarrierId !== SHIPPING_CARRIER_ID ||
      item?.variantId !== VARIANT_ID ||
      item.quantity !== 1
    ) {
      return json(response, 400, { message: 'Unexpected E2E order payload.' });
    }
    if (!orderCreated) orderCreatedAt = new Date().toISOString();
    orderCreated = true;
    return json(response, 201, order());
  }

  if (
    request.method === 'POST' &&
    url.pathname === `/api/v1/payments/orders/${ORDER_ID}/card-to-card/receipt`
  ) {
    if (!requireAuthentication(request, response)) return;
    if (!orderCreated) return json(response, 409, { message: 'Order has not been created.' });
    if (!(request.headers['content-type'] ?? '').startsWith('multipart/form-data;')) {
      return json(response, 415, { message: 'Receipt must use multipart form data.' });
    }
    for await (const chunk of request) {
      // Drain the multipart upload; payload details are validated by component tests.
      void chunk;
    }
    receiptSubmitted = true;
    return json(response, 201, {
      orderId: ORDER_ID,
      status: 'AWAITING_REVIEW',
      receiptUploadedAt: PAID_AT,
    });
  }

  if (
    request.method === 'POST' &&
    url.pathname === `/api/v1/payments/orders/${ORDER_ID}/initiate`
  ) {
    if (!requireAuthentication(request, response)) return;
    if (!orderCreated) return json(response, 409, { message: 'Order has not been created.' });
    const payload = await body(request);
    if (typeof payload.idempotencyKey !== 'string' || payload.idempotencyKey.length < 8) {
      return json(response, 400, { message: 'Invalid idempotency key.' });
    }
    return json(response, 201, {
      attemptId: ATTEMPT_ID,
      status: 'REDIRECTED',
      authority: 'E2E-AUTHORITY',
      paymentUrl: `${MOCK_API_ORIGIN}/gateway?attemptId=${ATTEMPT_ID}`,
      alreadyPaid: false,
      reconciliationRequired: false,
      reconciled: false,
    });
  }

  if (request.method === 'GET' && url.pathname === '/gateway') {
    if (url.searchParams.get('attemptId') !== ATTEMPT_ID) {
      return json(response, 404, { message: 'Payment attempt not found.' });
    }
    return gateway(response, ATTEMPT_ID);
  }

  if (request.method === 'GET' && url.pathname === `/api/v1/payments/callback/${ATTEMPT_ID}`) {
    if (url.searchParams.get('Authority') !== 'E2E-AUTHORITY') {
      return json(response, 400, { success: false, orderId: ORDER_ID });
    }
    if (!paymentConfirmed) paymentConfirmedAt = new Date().toISOString();
    paymentConfirmed = true;
    return json(response, 200, {
      success: true,
      orderId: ORDER_ID,
      reconciliationRequired: false,
      reconciled: false,
    });
  }

  if (request.method === 'GET' && url.pathname === `/api/v1/orders/me/${ORDER_ID}`) {
    if (!requireAuthentication(request, response)) return;
    if (!orderCreated) return json(response, 404, { message: 'Order not found.' });
    return json(response, 200, order());
  }

  return json(response, 404, { message: `No E2E fixture for ${request.method} ${url.pathname}` });
}

const server = createServer((request, response) => {
  handler(request, response).catch((error) => {
    console.error('E2E mock request failed:', error instanceof Error ? error.message : 'unknown');
    if (!response.headersSent) json(response, 500, { message: 'E2E mock request failed.' });
    else response.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Storefront E2E mock API listening on ${MOCK_API_ORIGIN}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
