import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CartRecoveryService } from '../src/modules/orders/cart-recovery.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';

it('requires a current review, consumes the restored cart on order and expires the next cart', async () => {
  const config = new ConfigService({
    OTP_PEPPER: 'cart-recovery-checkout-test',
    MANUAL_SHIPPING_COST_TOMAN: 700,
    SHIPPING_PROVIDER: 'disabled',
  });
  const db = new PrismaService(config);
  const carts = new CartRecoveryService(db);
  const orders = new OrdersService(
    db,
    undefined,
    config,
    undefined,
    undefined,
    undefined,
    new PromotionsService(db),
    undefined,
    carts,
  );
  const key = `saved-${randomUUID()}`;
  const phone = (suffix: string) =>
    `+0${BigInt(`0x${key.slice(6).replaceAll('-', '').slice(0, 12)}`)}${suffix}`;
  const buyers = { phone: { in: [phone('1'), phone('2')] } };
  const sku = { sku: key };
  try {
    const [buyer, outsider] = await Promise.all(
      buyers.phone.in.map((number) => db.user.create({ data: { phone: number } })),
    );
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ?? (await db.warehouse.create({ data: { name: key, code: key, isDefault: true } }));
    const product = await db.product.create({
      data: {
        name: key,
        slug: key,
        status: 'ACTIVE',
        salePriceToman: 4_000,
        variants: { create: sku },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0].id;
    const stock = await db.inventory.create({
      data: { variantId, warehouseId: warehouse.id, onHand: 3 },
    });
    const now = new Date();
    const old = new Date(+now - 48 * 3_600_000);
    const items = [{ variantId, quantity: 3 }];
    const saved = await carts.save(buyer.id, { items }, old);
    if (!saved.current) throw new Error('Expected a saved cart.');
    const version = saved.current;
    expect((await carts.status(buyer.id, now)).showReminder).toBe(true);
    expect((await carts.status(outsider.id, now)).current).toBeNull();
    await expect(carts.review(outsider.id, version)).rejects.toThrow('saved cart changed');
    await carts.dismiss(buyer.id, version, false, now);
    expect((await carts.status(buyer.id, now)).showReminder).toBe(false);
    const preview = await carts.review(buyer.id, version, undefined, now);

    await db.product.update({ where: { id: product.id }, data: { salePriceToman: 4_500 } });
    await db.inventory.update({ where: { id: stock.id }, data: { onHand: 2 } });
    const changed = await carts.review(buyer.id, version, preview.reviewKey, now);
    expect(changed).toMatchObject({
      applied: false,
      lines: [
        {
          previousQuantity: 3,
          previousUnitToman: 4_000,
          item: { quantity: 2, unitSalePriceToman: 4_500 },
        },
      ],
    });
    expect((await carts.review(buyer.id, version, changed.reviewKey, now)).applied).toBe(true);
    const body = {
      items: [{ variantId, quantity: 2 }],
      savedCartId: version.cartId,
      savedCartRevision: version.revision,
      shippingAddress: {
        recipientName: 'کاربر آزمون',
        phone: '09121234567',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'نشانی ساختگی آزمون',
        postalCode: '1234567890',
      },
    } satisfies CreateOrderDto;
    const quote = await orders.quotePrice(buyer.id, body);
    expect(quote.payableToman).toBe(9_700);
    const order = await orders.createOrder(buyer.id, { ...body, quoteToken: quote.quoteToken });
    await expect(carts.status(buyer.id)).resolves.toMatchObject({
      current: null,
      showReminder: false,
    });
    await expect(
      db.savedCart.findUniqueOrThrow({ where: { id: version.cartId } }),
    ).resolves.toMatchObject({
      orderId: order.id,
      items: [],
      activeUserId: null,
    });

    const second = await carts.save(buyer.id, { items }, new Date(+now - 20 * 24 * 3_600_000));
    if (!second.current) throw new Error('Expected a second saved cart.');
    await expect(carts.status(buyer.id, now)).resolves.toMatchObject({
      current: null,
      showReminder: false,
    });
    await expect(carts.review(buyer.id, second.current, undefined, now)).rejects.toThrow('expired');
    await carts.expireBatch(now);
    await expect(
      db.savedCart.findUniqueOrThrow({ where: { id: second.current.cartId } }),
    ).resolves.toMatchObject({
      items: [],
      activeUserId: null,
    });
  } finally {
    try {
      const order = { user: buyers };
      await db.$transaction([
        db.savedCart.deleteMany({ where: { user: buyers } }),
        db.orderPriceQuote.deleteMany({ where: { order } }),
        db.orderStatusHistory.deleteMany({ where: { order } }),
        db.orderAddress.deleteMany({ where: { order } }),
        db.orderItem.deleteMany({ where: { order } }),
        db.order.deleteMany({ where: order }),
        db.inventoryMovement.deleteMany({ where: { inventory: { variant: sku } } }),
        db.inventory.deleteMany({ where: { variant: sku } }),
        db.productVariant.deleteMany({ where: sku }),
        db.product.deleteMany({ where: { slug: key } }),
        db.warehouse.deleteMany({ where: { code: key } }),
        db.user.deleteMany({ where: buyers }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
