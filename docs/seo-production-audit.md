# SEO production audit and Search Console runbook

## Required production configuration

The production Compose file pins `STOREFRONT_PUBLIC_ORIGIN=https://hamidian.shop`.
For non-production environments, set the public origin explicitly. The optional
Search Console HTML token remains in the private production env file:

```env
GOOGLE_SITE_VERIFICATION=verification-token-from-search-console
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...
```

Prefer DNS verification for a Google Search Console Domain property. The HTML verification token is supported as a secondary verification method and is rendered only when `GOOGLE_SITE_VERIFICATION` is configured.

## Release checks

Run the automated suites before deployment:

```bash
pnpm contracts:generate
pnpm verify:contracts
pnpm api:test
pnpm api:test:e2e
pnpm api:lint
pnpm api:build
pnpm storefront:test
pnpm storefront:lint
pnpm storefront:typecheck
pnpm storefront:build
```

After deployment, run the HTTP audit against the public origin:

```bash
SEO_AUDIT_ORIGIN=https://example.com pnpm seo:audit
```

Audit the public knowledge hub separately. Before the first article is published, the audit accepts
an empty hub and skips article-level assertions:

```bash
SEO_AUDIT_ORIGIN=https://example.com pnpm seo:guide:audit
```

For launch and every later SEO release, require at least one published, indexable guide article:

```bash
SEO_AUDIT_ORIGIN=https://example.com \
SEO_AUDIT_REQUIRE_GUIDE=true \
pnpm seo:guide:audit
```

To select a representative article explicitly:

```bash
SEO_AUDIT_ORIGIN=https://example.com \
SEO_AUDIT_GUIDE_PATH=/guide/silver-care \
SEO_AUDIT_REQUIRE_GUIDE=true \
pnpm seo:guide:audit
```

If product canonicals use a custom route rather than `/products/{slug}`, provide one public product path explicitly:

```bash
SEO_AUDIT_ORIGIN=https://example.com \
SEO_AUDIT_PRODUCT_PATH=/custom-product-path \
pnpm seo:audit
```

To verify a known slug migration also returns a single-hop permanent redirect:

```bash
SEO_AUDIT_ORIGIN=https://example.com \
SEO_AUDIT_REDIRECT_PATH=/products/old-slug \
SEO_AUDIT_REDIRECT_DESTINATION=/products/new-slug \
pnpm seo:audit
```

The audit checks `robots.txt`, sitemap ownership/HTTPS/duplicates, product `lastmod`,
security headers, public canonicals, crawlable `noindex` utility pages, filtered-catalog
`noindex`, out-of-range pagination, Product or ProductGroup/Breadcrumb JSON-LD and optional
single-hop `308` redirects.

The guide audit checks the clean `/guide` canonical, `CollectionPage` JSON-LD, filtered-search
`noindex`, published article discovery in sitemap, valid article `lastmod`, self-canonical,
`Article`/`BreadcrumbList` JSON-LD, Persian language, connection to the knowledge collection, and
a crawlable link back to `/guide`.

## Search Console checklist

1. Verify the Domain property and keep the DNS record in place.
2. Submit `https://example.com/sitemap.xml` once; do not submit filtered catalog URLs.
3. Inspect the homepage, product list, categories hub, one product, one category and one brand with URL Inspection.
4. Confirm the selected canonical matches the production URL and request indexing for the initial representative pages.
5. Review Page indexing, Product snippets, Breadcrumbs and Core Web Vitals after Google processes the deployment.
6. After any slug change, inspect both URLs: the old URL must return one `308` hop and the new URL must be indexable and self-canonical.
7. Re-run `pnpm seo:audit` after every SEO release and monthly in production.
8. Re-run `pnpm seo:guide:audit` after publishing or changing guide templates and representative
   articles.

## Acceptance rules

- No account, API, cart, checkout, payment or wishlist URL may appear in the sitemap.
- HTML utility pages such as cart/wishlist remain crawlable but must expose `noindex`; robots.txt must not hide that directive.
- API and payment-result paths remain disallowed crawl targets.
- Search/filter variants remain `noindex,follow` and canonicalize to the clean catalog URL.
- Archived or inactive entities do not resolve through historical redirects.
- A current canonical path always wins over a stale redirect record.
- Redirect chains are collapsed during slug updates.
