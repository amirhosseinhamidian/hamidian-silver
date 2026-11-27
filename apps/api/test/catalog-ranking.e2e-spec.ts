import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import { OrderStatus, PaymentStatus, ProductStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CatalogMerchandisingService } from '../src/modules/catalog/catalog-merchandising.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicCatalogSort } from '../src/modules/catalog/dto/public-catalog-query.dto';
import type { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('ranks qualified sales and time-bound featured products within the filtered catalog', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back catalog ranking fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const now = Date.now();
        const day = 86_400_000;
        const category = await db.category.create({
          data: { name: 'Ranking', slug: `ranking-${suffix}` },
        });
        const warehouse = await db.warehouse.create({
          data: { name: 'Ranking', code: `ranking-${suffix}` },
        });
        const user = await db.user.create({
          data: { phone: suffix.replaceAll('-', '').slice(0, 20) },
        });
        const scopedPrisma = {
          product: db.product,
          $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(db),
        } as unknown as PrismaService;
        const catalog = new CatalogService(scopedPrisma, {} as PublicMediaUrlService);
        const merchandising = new CatalogMerchandisingService(scopedPrisma);

        const product = (
          id: string,
          label: string,
          price: number,
          onHand: number,
          status: ProductStatus = ProductStatus.ACTIVE,
        ) =>
          db.product.create({
            data: {
              id,
              name: label,
              slug: `${label}-${suffix}`,
              status,
              createdAt: new Date(now - day),
              salePriceToman: price,
              categories: { create: { categoryId: category.id } },
              variants: {
                create: {
                  sku: `${label}-${suffix}`,
                  salePriceToman: price,
                  inventories: { create: { warehouseId: warehouse.id, onHand } },
                },
              },
            },
            include: { variants: true },
          });
        const ids = Array.from({ length: 6 }, () => randomUUID()).sort();
        const seller = await product(ids[0], 'seller', 200_000, 2);
        const limited = await product(ids[1], 'limited', 100_000, 8);
        const pinned = await product(ids[2], 'pinned', 150_000, 2);
        const scheduled = await product(ids[3], 'scheduled', 170_000, 2);
        const unavailable = await product(ids[4], 'unavailable', 120_000, 0);
        const draft = await product(ids[5], 'draft', 100_000, 1, ProductStatus.DRAFT);
        const placeOrder = (
          item: typeof seller,
          orderStatus: OrderStatus = OrderStatus.PAID,
          paymentStatus: PaymentStatus = PaymentStatus.PAID,
          paidAt = new Date(now - day),
          returnedQuantity = 0,
          lines = 1,
        ) =>
          db.order.create({
            data: {
              orderNumber: randomUUID().replaceAll('-', ''),
              userId: user.id,
              warehouseId: warehouse.id,
              status: orderStatus,
              merchandiseTotalToman: item.salePriceToman! * lines,
              grandTotalToman: item.salePriceToman! * lines,
              createdAt: new Date(paidAt.getTime() - 60_000),
              reservationExpiresAt: new Date(now),
              paidAt: orderStatus === OrderStatus.PENDING_PAYMENT ? null : paidAt,
              deliveredAt: orderStatus === OrderStatus.DELIVERED ? paidAt : null,
              cancelledAt: orderStatus === OrderStatus.CANCELLED ? paidAt : null,
              payment: {
                create: {
                  status: paymentStatus,
                  amountToman: item.salePriceToman! * lines,
                  paidAt: paymentStatus === PaymentStatus.PENDING ? null : paidAt,
                },
              },
              items: {
                create: Array.from({ length: lines }, () => ({
                  variantId: item.variants[0].id,
                  productNameSnapshot: item.name,
                  skuSnapshot: item.variants[0].sku,
                  quantity: 1,
                  returnAllocatedQuantity: returnedQuantity,
                  returnedQuantity,
                  unitSalePriceToman: item.salePriceToman!,
                  lineTotalToman: item.salePriceToman!,
                })),
              },
            },
          });
        await placeOrder(seller);
        await placeOrder(seller, OrderStatus.DELIVERED);
        await placeOrder(seller, OrderStatus.DELIVERED, PaymentStatus.PARTIALLY_REFUNDED);
        await placeOrder(limited, OrderStatus.PAID, PaymentStatus.PAID, new Date(now - day), 0, 2);
        await placeOrder(limited);
        await placeOrder(limited, OrderStatus.PENDING_PAYMENT, PaymentStatus.PENDING);
        await placeOrder(limited, OrderStatus.CANCELLED);
        await placeOrder(limited, OrderStatus.DELIVERED, PaymentStatus.REFUNDED);
        await placeOrder(
          limited,
          OrderStatus.DELIVERED,
          PaymentStatus.PARTIALLY_REFUNDED,
          new Date(now - day),
          1,
        );
        await placeOrder(limited, OrderStatus.PAID, PaymentStatus.PAID, new Date(now - 31 * day));

        const best = { scopeCategory: category.slug, sort: PublicCatalogSort.BEST_SELLING };
        const first = await catalog.searchPublicCatalog({ ...best, pageSize: 2 });
        const second = await catalog.searchPublicCatalog({ ...best, pageSize: 2, page: 2 });
        expect(first.items.map(({ id }) => id)).toEqual([seller.id, scheduled.id]);
        expect(second.items.map(({ id }) => id)).toEqual([pinned.id, limited.id]);
        await expect(catalog.searchPublicCatalog({ ...best, pageSize: 2 })).resolves.toEqual(first);
        expect(first.ranking).toEqual({
          version: 1,
          requestedSort: 'best-selling',
          appliedSort: 'best-selling',
        });
        const fallback = await catalog.searchPublicCatalog({ ...best, maxPriceToman: 180_000 });
        expect(fallback.ranking?.appliedSort).toBe('newest');
        expect(fallback.items.map(({ id }) => id)).toEqual([scheduled.id, pinned.id, limited.id]);
        await expect(
          catalog.listPublicProducts({
            category: category.slug,
            sort: PublicCatalogSort.AVAILABILITY,
          }),
        ).resolves.toMatchObject({
          items: [limited, scheduled, pinned, seller, unavailable].map(({ id }) => ({ id })),
        });

        const active = {
          enabled: true,
          pinned: true,
          weight: 0,
          startsAt: new Date(now - day).toISOString(),
          endsAt: new Date(now + day).toISOString(),
          expectedRevision: 0,
        };
        await expect(merchandising.read(pinned.id)).resolves.toMatchObject({
          enabled: false,
          revision: 0,
        });
        await expect(merchandising.update(draft.id, active)).rejects.toThrow('Only published');
        await expect(merchandising.update(seller.id, { ...active, pinned: false })).rejects.toThrow(
          'positive weight',
        );
        await expect(merchandising.update(pinned.id, active)).resolves.toMatchObject({
          revision: 1,
          pinned: true,
        });
        await expect(merchandising.update(pinned.id, active)).rejects.toThrow('settings changed');
        await merchandising.update(seller.id, { ...active, pinned: false, weight: 100 });
        await merchandising.update(unavailable.id, { ...active, weight: 100 });
        await merchandising.update(scheduled.id, {
          ...active,
          weight: 100,
          startsAt: new Date(now + day).toISOString(),
          endsAt: new Date(now + 2 * day).toISOString(),
        });
        await db.catalogMerchandisingEntry.create({
          data: {
            productId: limited.id,
            enabled: true,
            pinned: true,
            weight: 100,
            startsAt: new Date(now - 2 * day),
            endsAt: new Date(now - day),
          },
        });

        const featured = await catalog.searchPublicCatalog({
          scopeCategory: category.slug,
          sort: PublicCatalogSort.FEATURED,
        });
        expect(featured.items.map(({ id }) => id)).toEqual([
          pinned.id,
          seller.id,
          scheduled.id,
          limited.id,
          unavailable.id,
        ]);
        expect(featured.items[0]).toMatchObject({ salePriceToman: 150_000, availableQuantity: 2 });
        expect(featured.facets).toEqual(first.facets);
        await merchandising.update(pinned.id, { ...active, enabled: false, expectedRevision: 1 });
        await expect(
          catalog.searchPublicCatalog({
            scopeCategory: category.slug,
            sort: PublicCatalogSort.FEATURED,
            pageSize: 1,
          }),
        ).resolves.toMatchObject({ items: [{ id: seller.id }] });

        const reservedSlots = Array.from({ length: 24 }, () => randomUUID());
        await db.catalogMerchandisingEntry.updateMany({ data: { enabled: false } });
        await db.product.createMany({
          data: reservedSlots.map((id) => ({
            id,
            slug: id,
            name: 'Scheduled fixture',
            status: ProductStatus.ACTIVE,
          })),
        });
        await db.catalogMerchandisingEntry.createMany({
          data: reservedSlots.map((productId) => ({
            productId,
            enabled: true,
            pinned: true,
            startsAt: new Date(now + day),
            endsAt: new Date(now + 2 * day),
          })),
        });
        await expect(
          merchandising.update(pinned.id, { ...active, expectedRevision: 2 }),
        ).rejects.toThrow('limit of 24');
        await db.catalogMerchandisingEntry.update({
          where: { productId: reservedSlots[0] },
          data: { enabled: false },
        });
        await expect(
          merchandising.update(pinned.id, { ...active, expectedRevision: 2 }),
        ).resolves.toMatchObject({ revision: 3 });
        throw rollback;
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);
