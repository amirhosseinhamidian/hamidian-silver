import { BsjSilverCrawlerAdapter } from './bsj-silver-crawler.adapter';

describe('BsjSilverCrawlerAdapter', () => {
  const adapter = new BsjSilverCrawlerAdapter();

  it('extracts reviewable product data from a BSJ product page', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"عنوان ساختاریافته","sku":"10611820","description":"دستبند &amp; نقره","image":["https://bsjsilver.com/images/structured.webp"],"price":"246380000","priceCurrency":"IRR"}
      </script>
      <div id="frmSecProductMain"><h1>دستبند نقره ونکلیف رادیوم مدل ۷</h1></div>
      <a class="cro-category-name">دستبند نقره</a>
      <span id="frmLblPayablePriceAmount">۲۴٬۶۳۸٬۰۰۰</span>
      <ul id="product-spec-list">
        <li><span class="technicalspecs-title">وزن تقریبی</span><span class="technicalspecs-value">13.780 گرم</span></li>
        <li><span class="technicalspecs-title">نوع آبکاری</span><span class="technicalspecs-value">رادیوم</span></li>
      </ul>
      <div id="frmPnlProductGallery">
        <a data-imgurl="/images/one.jpg"></a>
        <a data-imgurl="https://bsjsilver.com/images/two.webp"></a>
      </div>
    `;

    expect(
      adapter.parseProduct(
        html,
        'https://bsjsilver.com/product/10611820-silver-bracelet#!/tab-techspecs/',
      ),
    ).toEqual(
      expect.objectContaining({
        sourceProductKey: '10611820',
        sourceSku: '10611820',
        title: 'دستبند نقره ونکلیف رادیوم مدل ۷',
        description: 'دستبند & نقره',
        sourceCategory: 'دستبند نقره',
        supplierRetailPriceToman: 24_638_000,
        weightGrams: 13.78,
        attributes: [
          { key: 'وزن تقریبی', value: '13.780 گرم' },
          { key: 'نوع آبکاری', value: 'رادیوم' },
        ],
        imageUrls: [
          'https://bsjsilver.com/images/one.jpg',
          'https://bsjsilver.com/images/two.webp',
          'https://bsjsilver.com/images/structured.webp',
        ],
      }),
    );
  });

  it('uses the product URL key and converts structured IRR price when visible price is absent', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"انگشتر نقره","price":"12000000","priceCurrency":"IRR"}
      </script>
    `;

    expect(adapter.parseProduct(html, 'https://bsjsilver.com/product/12345-ring')).toEqual(
      expect.objectContaining({
        sourceProductKey: '12345',
        supplierRetailPriceToman: 1_200_000,
      }),
    );
  });

  it('extracts dynamic categories and newest product listing links', () => {
    const html = `
      <a href="/product/category/12-bracelet">دستبند نقره</a>
      <a href="/product/10611820-bracelet">محصول اول</a>
      <a href="/product/10611821-ring">محصول دوم</a>
      <a href="?like=0&amp;page=2">بعدی</a>
    `;

    expect(adapter.parseCategories(html, 'https://bsjsilver.com/product')).toEqual([
      expect.objectContaining({ externalKey: '12', name: 'دستبند نقره' }),
    ]);
    expect(adapter.parseListing(html, 'https://bsjsilver.com/product?page=1')).toEqual({
      productUrls: [
        'https://bsjsilver.com/product/10611820-bracelet',
        'https://bsjsilver.com/product/10611821-ring',
      ],
      childCategoryUrls: ['https://bsjsilver.com/product/category/12-bracelet'],
      hasNextPage: true,
    });
    expect(adapter.listingUrl('https://bsjsilver.com/', 2)).toContain('order=new');
    expect(adapter.listingUrl('https://bsjsilver.com/', 2)).toContain('page=2');
  });

  it('uses the BSJ search endpoint and parses its JSON product list', () => {
    const request = adapter.listingRequest(
      'https://bsjsilver.com/product/category/64444-earrings',
      2,
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      }),
    );
    expect(request.url).toContain('/product/searching/');
    expect(request.body).toContain('id=64444');
    expect(request.body).toContain('page=2');
    expect(request.body).toContain('order=new');

    expect(
      adapter.parseListing(
        JSON.stringify({
          status: 'OK',
          total: 35,
          from: 11,
          to: 20,
          list: [
            { share: 'https://bsjsilver.com/product/10607361-earring' },
            {
              share: 'https://bsjsilver.com/product/10607362-earring?quick=1',
            },
          ],
        }),
        'https://bsjsilver.com/product/category/64444-earrings?page=2',
      ),
    ).toEqual({
      productUrls: [
        'https://bsjsilver.com/product/10607361-earring',
        'https://bsjsilver.com/product/10607362-earring',
      ],
      childCategoryUrls: [],
      hasNextPage: true,
    });
  });

  it('returns child categories from a parent BSJ category response', () => {
    expect(
      adapter.parseListing(
        JSON.stringify({
          status: 'OK',
          category: [
            { share: 'https://bsjsilver.com/product/category/65785-stud-earrings' },
            { share: 'https://bsjsilver.com/product/category/65786-drop-earrings' },
          ],
        }),
        'https://bsjsilver.com/product/category/64444-earrings',
      ),
    ).toEqual({
      productUrls: [],
      childCategoryUrls: [
        'https://bsjsilver.com/product/category/65785-stud-earrings',
        'https://bsjsilver.com/product/category/65786-drop-earrings',
      ],
      hasNextPage: false,
    });
  });
});
