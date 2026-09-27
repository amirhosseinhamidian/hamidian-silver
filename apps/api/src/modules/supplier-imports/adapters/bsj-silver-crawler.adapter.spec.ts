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
});
