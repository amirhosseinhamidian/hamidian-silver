import Link from 'next/link';
import { FiCheckCircle, FiCreditCard, FiPackage, FiShield } from 'react-icons/fi';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { HomepageHero } from '@/components/home/homepage-hero';
import type { PublicHomepage, PublicHomepageFeaturedCategory } from '@/lib/home/public-homepage';

type StorefrontHomeProps = Readonly<{ homepage: PublicHomepage }>;

function SectionHeading({ title, href }: Readonly<{ title: string; href?: string }>) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
      <h2 className="text-2xl font-medium sm:text-3xl">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-sm text-[var(--sf-color-muted)] hover:text-[var(--sf-color-ink)]"
        >
          مشاهده همه
        </Link>
      ) : null}
    </div>
  );
}

function CategoryPair({ categories }: Readonly<{ categories: PublicHomepageFeaturedCategory[] }>) {
  if (categories.length === 0) return null;

  return (
    <section aria-label="دسته‌بندی‌های منتخب" className="sf-container py-[var(--sf-section-space)]">
      <ul className="grid gap-8 md:grid-cols-2 md:gap-5">
        {categories.map((category) => (
          <li key={category.id}>
            <Link href={`/categories/${category.slug}`} className="group block">
              <div className="aspect-[4/3] overflow-hidden bg-[var(--sf-color-surface)]">
                <CatalogMedia
                  media={category.image}
                  alt={category.name}
                  imageClassName="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="pt-5 text-center">
                <h2 className="text-xl font-medium sm:text-2xl">{category.name}</h2>
                {category.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--sf-color-muted)]">
                    {category.description}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StorefrontHome({ homepage }: StorefrontHomeProps) {
  const firstCategories = homepage.featuredCategories.filter(({ priority }) => priority <= 2);
  const lastCategories = homepage.featuredCategories.filter(
    ({ priority }) => priority >= 3 && priority <= 4,
  );
  const benefits = [
    {
      title: 'انتخاب شفاف',
      description: 'جزئیات کامل محصول و قیمت پیش از خرید',
      Icon: FiCheckCircle,
    },
    { title: 'پرداخت امن', description: 'پرداخت آنلاین از مسیر امن بانکی', Icon: FiCreditCard },
    { title: 'پیگیری سفارش', description: 'مشاهده وضعیت سفارش از حساب کاربری', Icon: FiPackage },
    { title: 'ضمانت کیفیت', description: 'کنترل کیفیت دقیق پیش از ارسال', Icon: FiShield },
  ];
  const featuredBrands = homepage.featuredBrands.slice(0, 4);

  return (
    <main id="main-content">
      <HomepageHero slides={homepage.primaryHeroSlides} label="اسلایدهای اصلی فروشگاه" />

      <section
        aria-labelledby="new-products-title"
        className="sf-container py-[var(--sf-section-space)]"
      >
        <SectionHeading title="جدیدترین محصولات" href="/products" />
        <ul className="grid grid-cols-2 gap-x-2 gap-y-8 lg:grid-cols-4 lg:gap-4">
          {homepage.newProducts.map((product) => (
            <CatalogProductCard key={product.id} product={product} badge="جدید" />
          ))}
        </ul>
      </section>

      <CategoryPair categories={firstCategories} />

      {homepage.popularProducts.length > 0 ? (
        <section
          aria-labelledby="popular-products-title"
          className="sf-container py-[var(--sf-section-space)]"
        >
          <SectionHeading title="محبوب‌ترین محصولات" href="/products" />
          <ul className="grid grid-cols-2 gap-x-2 gap-y-8 lg:grid-cols-4 lg:gap-4">
            {homepage.popularProducts.map((product) => (
              <CatalogProductCard key={product.id} product={product} />
            ))}
          </ul>
        </section>
      ) : null}

      {featuredBrands.length > 0 ? (
        <section
          aria-labelledby="brands-title"
          className="sf-container py-[var(--sf-section-space)]"
        >
          <SectionHeading title="برندها" href="/brands" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
            {featuredBrands.map((brand) => (
              <li key={brand.id}>
                <Link href={`/brands/${brand.slug}`} className="group block text-center">
                  <div className="mx-auto aspect-[4/3] w-full max-w-40 overflow-hidden">
                    <CatalogMedia
                      media={brand.image}
                      alt={brand.name}
                      imageClassName="object-contain grayscale transition duration-500 ease-out group-hover:scale-105 group-hover:grayscale-0"
                    />
                  </div>
                  <h3 className="mt-4 text-base font-medium">{brand.name}</h3>
                  {brand.originCountry ? (
                    <p className="mt-1 text-xs text-[var(--sf-color-muted)]">
                      برند {brand.originCountry.name}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {homepage.manufacturerCountriesEnabled && homepage.manufacturerCountries.length > 0 ? (
        <section aria-label="کشورهای سازنده" className="sf-container py-[var(--sf-section-space)]">
          <SectionHeading title="کشورهای سازنده" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-8">
            {homepage.manufacturerCountries.map((country) => (
              <li key={country.id}>
                <Link
                  href={`/products?country=${encodeURIComponent(country.slug)}`}
                  className="group block text-center"
                >
                  <div className="mx-auto aspect-square w-full overflow-hidden rounded-full bg-[var(--sf-color-surface)]">
                    <CatalogMedia
                      media={country.image}
                      alt={country.name}
                      imageClassName="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                  <h3 className="mt-4 text-sm font-medium">{country.name}</h3>
                  <span className="mt-1 block text-xs text-[var(--sf-color-muted)]">
                    مشاهده محصولات
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {homepage.secondaryHero ? (
        <HomepageHero slides={[homepage.secondaryHero]} label="تصویر ویژه فروشگاه" compact />
      ) : null}

      <CategoryPair categories={lastCategories} />

      <section
        aria-labelledby="benefits-title"
        className="border-t border-[var(--sf-color-border)]"
      >
        <h2 id="benefits-title" className="sr-only">
          مزیت‌های خرید
        </h2>
        <ul className="sf-container grid gap-px py-[var(--sf-section-space)] sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ title, description, Icon }) => (
            <li key={title} className="flex flex-col items-center px-6 py-8 text-center">
              <Icon aria-hidden="true" className="size-8 stroke-[1.25]" />
              <h3 className="mt-5 text-base font-medium">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-[var(--sf-color-muted)]">{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
