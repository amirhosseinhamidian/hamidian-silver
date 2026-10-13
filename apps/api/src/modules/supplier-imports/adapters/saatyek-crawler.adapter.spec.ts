import { SaatYekCrawlerAdapter } from './saatyek-crawler.adapter';

describe('SaatYekCrawlerAdapter', () => {
  const adapter = new SaatYekCrawlerAdapter();

  it('extracts reviewable watch data from WooCommerce structured data and attributes', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context":"https://schema.org",
          "@graph":[{
            "@type":"Product",
            "name":"ساعت مچی مردانه CASIO EFV-150D-1A",
            "sku":"EFV-150D-1A",
            "description":"ساعت کاسیو با بدنه استیل",
            "category":"ساعت مردانه",
            "image":["https://saatyek.com/wp-content/uploads/watch-main.webp"],
            "offers":{"price":"84500000","priceCurrency":"IRR","availability":"https://schema.org/InStock"}
          }]
        }
      </script>
      <table class="woocommerce-product-attributes">
        <tr class="woocommerce-product-attributes-item">
          <th class="woocommerce-product-attributes-item__label">وزن</th>
          <td class="woocommerce-product-attributes-item__value"><p>۱۲۰ گرم</p></td>
        </tr>
        <tr class="woocommerce-product-attributes-item">
          <th class="woocommerce-product-attributes-item__label">جنس بند</th>
          <td class="woocommerce-product-attributes-item__value"><p>استیل</p></td>
        </tr>
      </table>
      <div class="woocommerce-product-gallery__image" data-large_image="/wp-content/uploads/watch-two.webp"></div>
    `;

    expect(
      adapter.parseProduct(html, 'https://saatyek.com/product/ساعت-مچی-مردانه-casio-efv-150d-1a/'),
    ).toEqual(
      expect.objectContaining({
        sourceProductKey: 'ساعت-مچی-مردانه-casio-efv-150d-1a',
        sourceSku: 'EFV-150D-1A',
        title: 'ساعت مچی مردانه CASIO EFV-150D-1A',
        description: 'ساعت کاسیو با بدنه استیل',
        sourceCategory: 'ساعت مردانه',
        supplierRetailPriceToman: 8_450_000,
        availability: 'IN_STOCK',
        weightGrams: 120,
        attributes: [
          { key: 'وزن', value: '۱۲۰ گرم' },
          { key: 'جنس بند', value: 'استیل' },
        ],
        imageUrls: [
          'https://saatyek.com/wp-content/uploads/watch-two.webp',
          'https://saatyek.com/wp-content/uploads/watch-main.webp',
        ],
      }),
    );
  });

  it('does not import a one-toman sentinel as the supplier retail price', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"ساعت تست","offers":{"price":"1","priceCurrency":"IRT"}}
      </script>
    `;

    expect(adapter.parseProduct(html, 'https://saatyek.com/product/test-watch/')).toEqual(
      expect.objectContaining({
        supplierRetailPriceToman: null,
        rawPayload: expect.objectContaining({ rejectedSentinelPrice: true }),
      }),
    );
  });

  it('extracts dynamic WooCommerce category links from the shop page', () => {
    const html = `
      <a href="https://saatyek.com/product-category/casio/">کاسیو</a>
      <a href="/product-category/g-shock/">جی شاک</a>
      <a href="/product/test-watch/">محصول</a>
    `;

    expect(adapter.parseCategories(html, 'https://saatyek.com/shop/')).toEqual([
      { externalKey: 'casio', name: 'کاسیو', url: 'https://saatyek.com/product-category/casio/' },
      {
        externalKey: 'g-shock',
        name: 'جی شاک',
        url: 'https://saatyek.com/product-category/g-shock/',
      },
    ]);
  });

  it('uses the public Store API for catalog pagination', () => {
    const request = adapter.listingRequest('https://saatyek.com/', 2);
    expect(request).toEqual(
      expect.objectContaining({
        method: 'GET',
        referer: 'https://saatyek.com/shop/page/2/',
      }),
    );
    expect(request.url).toContain('/wp-json/wc/store/v1/products');
    expect(request.url).toContain('page=2');
    expect(request.url).toContain('per_page=50');
    expect(request.requiresXsrfSession).toBeUndefined();

    expect(
      adapter.parseListing(
        JSON.stringify([
          {
            id: 10,
            permalink: 'https://saatyek.com/product/watch-one/',
          },
          {
            id: 11,
            permalink: 'https://saatyek.com/product/watch-two/',
          },
        ]),
        'https://saatyek.com/shop/',
      ),
    ).toEqual({
      productUrls: [
        'https://saatyek.com/product/watch-one/',
        'https://saatyek.com/product/watch-two/',
      ],
      childCategoryUrls: [],
      hasNextPage: false,
    });
  });

  it('uses direct HTML pagination for a selected supplier category', () => {
    const request = adapter.listingRequest('https://saatyek.com/product-category/casio/', 3);
    expect(request).toEqual({
      url: 'https://saatyek.com/product-category/casio/page/3/',
      method: 'GET',
      referer: 'https://saatyek.com/product-category/casio/page/3/',
    });
    expect(
      adapter.parseListing(
        `
          <a href="/product/casio-one/">کاسیو یک</a>
          <a class="next page-numbers" href="/product-category/casio/page/4/">بعدی</a>
        `,
        request.url,
      ),
    ).toEqual({
      productUrls: ['https://saatyek.com/product/casio-one/'],
      childCategoryUrls: [],
      hasNextPage: true,
    });
  });
});
