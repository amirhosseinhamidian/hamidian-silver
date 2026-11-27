import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service';

export async function seedReferralPurchase(
  db: PrismaService,
  userId: string,
  purchasedAt = new Date(Date.now() - 86_400_000),
) {
  const key = randomUUID();
  const warehouse = await db.warehouse.create({ data: { code: key, name: 'Referral test' } });
  const variant = await db.productVariant.create({
    data: {
      sku: key,
      product: { create: { name: 'Referral test', slug: key, salePriceToman: 25_000 } },
    },
  });
  return db.order.create({
    data: {
      userId,
      warehouseId: warehouse.id,
      orderNumber: key.replaceAll('-', ''),
      status: 'DELIVERED',
      createdAt: purchasedAt,
      paidAt: purchasedAt,
      deliveredAt: purchasedAt,
      reservationExpiresAt: purchasedAt,
      merchandiseTotalToman: 25_000,
      grandTotalToman: 25_000,
      payment: { create: { amountToman: 25_000, status: 'PAID', paidAt: purchasedAt } },
      items: {
        create: {
          variantId: variant.id,
          productNameSnapshot: 'Referral test',
          skuSnapshot: key,
          quantity: 1,
          unitSalePriceToman: 25_000,
          lineTotalToman: 25_000,
        },
      },
    },
    select: { id: true },
  });
}
