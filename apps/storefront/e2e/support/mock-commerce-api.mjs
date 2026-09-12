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
const CREATED_AT = '2026-09-11T08:00:00.000Z';
const PAID_AT = '2026-09-11T08:02:00.000Z';

let paymentConfirmed = false;
let orderCreated = false;
let apiUnavailable = false;

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
    paidAt: paymentConfirmed ? PAID_AT : null,
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
    createdAt: CREATED_AT,
    updatedAt: paymentConfirmed ? PAID_AT : CREATED_AT,
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
          { fromStatus: null, toStatus: 'PENDING_PAYMENT', createdAt: CREATED_AT },
          { fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID', createdAt: PAID_AT },
        ]
      : [{ fromStatus: null, toStatus: 'PENDING_PAYMENT', createdAt: CREATED_AT }],
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
    orderCreated = false;
    apiUnavailable = false;
    return json(response, 200, { reset: true });
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

  if (request.method === 'GET' && url.pathname === '/api/v1/catalog/public/products/silver-ring') {
    return json(response, 200, product);
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

  if (request.method === 'POST' && url.pathname === '/api/v1/orders') {
    if (!requireAuthentication(request, response)) return;
    const payload = await body(request);
    const item = payload.items?.[0];
    if (
      payload.userAddressId !== ADDRESS_ID ||
      item?.variantId !== VARIANT_ID ||
      item.quantity !== 1
    ) {
      return json(response, 400, { message: 'Unexpected E2E order payload.' });
    }
    orderCreated = true;
    return json(response, 201, order());
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
