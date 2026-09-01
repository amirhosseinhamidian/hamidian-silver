export interface OrderItem {
  id: string;

  orderId: string;
  variantId: string;

  quantity: number;

  productNameSnapshot: string;
  variantNameSnapshot?: string | null;
  skuSnapshot: string;
  sizeLabelSnapshot?: string | null;

  unitSalePriceToman: number;
  lineTotalToman: number;

  platingType?: 'GOLD' | 'RHODIUM' | null;
  unitPlatingPriceToman: number;

  createdAt: string;
}
