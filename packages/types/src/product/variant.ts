export interface ProductVariant {
  id: string;

  productId: string;

  sizeId?: string | null;

  sku: string;

  name?: string | null;

  weightGrams?: number | null;

  isActive: boolean;

  platingEligible: boolean;

  createdAt: string;
  updatedAt: string;
}
