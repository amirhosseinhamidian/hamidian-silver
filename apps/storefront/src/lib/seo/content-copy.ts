import type {
  PublicCatalogBrandPage,
  PublicCatalogCategoryPage,
  PublicCatalogProductDetail,
} from '@/lib/catalog/public-catalog';

function compact(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function silverLabel(name: string): string {
  const normalized = name.trim();
  return normalized.includes('نقره') ? normalized : `${normalized} نقره`;
}

type CategorySeoSource = Pick<PublicCatalogCategoryPage, 'name' | 'description'>;
type BrandSeoSource = Pick<PublicCatalogBrandPage, 'name' | 'description'>;
type ProductSeoSource = Pick<
  PublicCatalogProductDetail,
  'name' | 'shortDescription' | 'description' | 'brand' | 'country' | 'categories'
>;

export function categorySeoTitle(category: CategorySeoSource): string {
  return `خرید ${silverLabel(category.name)}`;
}

export function categorySeoDescription(category: CategorySeoSource): string {
  return (
    compact(category.description) ??
    `خرید و مشاهده مدل‌های ${silverLabel(category.name)} در گالری حمیدیان؛ بررسی قیمت، مشخصات و موجودی محصولات.`
  );
}

export function brandSeoTitle(brand: BrandSeoSource): string {
  return `کالکشن ${brand.name.trim()}`;
}

export function brandSeoDescription(brand: BrandSeoSource): string {
  return (
    compact(brand.description) ??
    `مشاهده محصولات نقره کالکشن ${brand.name.trim()} در گالری حمیدیان؛ بررسی قیمت، مشخصات و موجودی مدل‌ها.`
  );
}

export function productSeoDescription(product: ProductSeoSource): string {
  const productName = product.name.trim();
  const facts = [
    product.brand?.name?.trim() ? `برند ${product.brand.name.trim()}` : null,
    product.country?.name?.trim() ? `ساخت ${product.country.name.trim()}` : null,
    product.categories[0]?.name?.trim() ? `دسته ${product.categories[0].name.trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  const longDescription = compact(product.description);
  if (longDescription && longDescription.length >= 70 && longDescription.length <= 220) {
    return longDescription;
  }

  const factsText = facts.length ? `؛ ${facts.join('، ')}` : '';
  return `خرید و مشاهده ${productName} در گالری حمیدیان${factsText}؛ بررسی قیمت، تصاویر، مشخصات، سایزبندی و موجودی محصول.`;
}

export const HOME_SEO = {
  title: 'گالری حمیدیان | خرید زیورآلات نقره',
  description:
    'خرید زیورآلات نقره از گالری حمیدیان؛ مشاهده کالکشن‌های دستبند، گردنبند، انگشتر و سایر محصولات همراه با قیمت و مشخصات.',
} as const;

export const ROOT_CATALOG_SEO = {
  title: 'خرید محصولات نقره',
  description:
    'خرید و مشاهده محصولات نقره گالری حمیدیان؛ بررسی قیمت، مشخصات، دسته‌بندی‌ها، برندها و موجودی مدل‌ها.',
} as const;
