import Link from 'next/link';
import type { Metadata } from 'next';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { getPublicCatalogCategories } from '@/lib/catalog/public-catalog';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [settings, categories] = await Promise.all([
    getPublicSiteSettings(),
    getPublicCatalogCategories(),
  ]);

  return buildStorefrontPageMetadata(settings, {
    pathname: '/categories',
    title: 'دسته‌بندی‌های نقره',
    description: 'دسته‌بندی‌های محصولات نقره گالری حمیدیان را بر اساس نوع زیورآلات مرور کنید.',
    seoNoIndex: categories.length === 0,
  });
}

export default async function CategoriesPage() {
  const categories = await getPublicCatalogCategories();
  const byId = new Map(categories.map((category) => [category.id, category] as const));
  const roots = categories.filter((category) => !category.parentId || !byId.has(category.parentId));
  const childrenByParent = new Map<string, typeof categories>();

  for (const category of categories) {
    if (!category.parentId || !byId.has(category.parentId)) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    childrenByParent.set(category.parentId, [...children, category]);
  }

  return (
    <main id="main-content" className="sf-container py-12 sm:py-20">
      <header className="max-w-3xl border-b border-[var(--sf-color-border)] pb-10 sm:pb-14">
        <StorefrontBreadcrumbs
          items={[
            { label: 'خانه', href: '/' },
            { label: 'دسته‌بندی‌ها', href: '/categories' },
          ]}
          className="mb-7 text-[var(--sf-color-muted)]"
        />
        <p className="text-sm text-[var(--sf-color-muted)]">راهنمای انتخاب</p>
        <h1 className="mt-3 text-4xl font-normal sm:text-6xl">دسته‌بندی محصولات نقره</h1>
        <p className="mt-6 max-w-2xl text-sm leading-8 text-[var(--sf-color-muted)] sm:text-base">
          مجموعه‌های گالری را بر اساس نوع زیورآلات مرور کنید و سریع‌تر به محصول موردنظر برسید.
        </p>
      </header>

      <section
        aria-label="دسته‌بندی‌های محصولات"
        className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-3 sm:py-14"
      >
        {roots.map((category) => {
          const children = childrenByParent.get(category.id) ?? [];

          return (
            <article
              key={category.id}
              className="overflow-hidden border border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]"
            >
              <Link href={`/categories/${category.slug}`} className="group block">
                {category.image?.url ? (
                  <div className="aspect-square overflow-hidden bg-[var(--sf-color-surface)]">
                    <CatalogMedia
                      media={category.image}
                      alt={category.image.altText?.trim() || category.name}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      imageClassName="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <h2 className="text-2xl font-normal">{category.name}</h2>
                  {category.description ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--sf-color-muted)]">
                      {category.description}
                    </p>
                  ) : null}
                </div>
              </Link>

              {children.length ? (
                <nav
                  aria-label={`زیرمجموعه‌های ${category.name}`}
                  className="border-t border-[var(--sf-color-border)] px-6 py-5"
                >
                  <ul className="flex flex-wrap gap-x-5 gap-y-3">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/categories/${child.slug}`}
                          className="text-sm text-[var(--sf-color-muted)] underline-offset-4 hover:underline"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
