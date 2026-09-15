# SEO production audit and Search Console runbook

## Required production configuration

```env
STOREFRONT_PUBLIC_ORIGIN=https://example.com
GOOGLE_SITE_VERIFICATION=verification-token-from-search-console
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

The audit checks `robots.txt`, sitemap ownership and duplicates, private-route exclusion, canonical URLs, indexability, Product/Breadcrumb JSON-LD and optional `308` redirects.

## Search Console checklist

1. Verify the Domain property and keep the DNS record in place.
2. Submit `https://example.com/sitemap.xml` once; do not submit filtered catalog URLs.
3. Inspect the homepage, product list, one product, one category and one brand with URL Inspection.
4. Confirm the selected canonical matches the production URL and request indexing for the initial representative pages.
5. Review Page indexing, Product snippets, Breadcrumbs and Core Web Vitals after Google processes the deployment.
6. After any slug change, inspect both URLs: the old URL must return one `308` hop and the new URL must be indexable and self-canonical.
7. Re-run `pnpm seo:audit` after every SEO release and monthly in production.

## Acceptance rules

- No account, API, cart, checkout, payment or wishlist URL may appear in the sitemap.
- Search/filter variants remain `noindex,follow` and canonicalize to the clean catalog URL.
- Archived or inactive entities do not resolve through historical redirects.
- A current canonical path always wins over a stale redirect record.
- Redirect chains are collapsed during slug updates.
