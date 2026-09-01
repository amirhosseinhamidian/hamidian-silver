import type { ProductVariant } from './variant';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SizeMode = 'NONE' | 'FREE_SIZE' | 'SIZED';

export interface Product {
  id: string;
  name: string;
  slug: string;

  shortDescription?: string | null;
  description?: string | null;

  status: ProductStatus;
  sizeMode: SizeMode;

  brandId?: string | null;
  countryId?: string | null;

  salePriceToman?: number | null;

  createdAt: string;
  updatedAt: string;

  variants?: ProductVariant[];
}
