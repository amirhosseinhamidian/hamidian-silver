import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  CatalogAttributeKind,
  CatalogAttributeSource,
  CatalogAttributeUnit,
  ProductStatus,
  SizeMode,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicCatalogAvailability } from '../src/modules/catalog/dto/public-catalog-facets.dto';
import { PublicCatalogSort } from '../src/modules/catalog/dto/public-catalog-query.dto';
import type { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('uses sellable variants and counts distinct products under every other facet', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back facet fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const root = await db.category.create({ data: { name: 'Root', slug: `root-${suffix}` } });
        const child = await db.category.create({
          data: { name: 'Child', slug: `child-${suffix}`, parentId: root.id },
        });
        const outside = await db.category.create({
          data: { name: 'Outside', slug: `outside-${suffix}` },
        });
        const brand = (name: string) =>
          db.brand.create({ data: { name, slug: `${name}-${suffix}` } });
        const a = await brand('alfa');
        const b = await brand('beta');
        const hiddenBrand = await brand('hidden');
        const warehouse = await db.warehouse.create({
          data: { name: 'Facet fixture', code: `facets-${suffix}` },
        });
        const group = await db.sizeGroup.create({
          data: {
            name: 'Facet sizes',
            code: `facets-${suffix}`,
            selectionLabel: 'Size',
            cartLabel: 'Size',
          },
        });
        const [sizeA, sizeB, sizeC] = await Promise.all(
          ['a', 'b', 'c'].map((code) =>
            db.size.create({ data: { groupId: group.id, code, label: code } }),
          ),
        );
        const product = (
          name: string,
          brandId: string,
          categoryIds: string[],
          status: ProductStatus = ProductStatus.ACTIVE,
        ) =>
          db.product.create({
            data: {
              name,
              slug: `${name}-${suffix}`,
              brandId,
              status,
              sizeMode: SizeMode.SIZED,
              categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
            },
          });
        const main = await product('main', a.id, [root.id, child.id, outside.id]);
        const country = await db.country.create({
          data: { name: 'Facet fixture country', slug: `country-${suffix}`, isoCode: 'XZ' },
        });
        await db.product.update({ where: { id: main.id }, data: { countryId: country.id } });
        const second = await product('other', b.id, [child.id]);
        const unavailable = await product('unavailable', a.id, [child.id]);
        const draft = await product('hidden', hiddenBrand.id, [child.id], ProductStatus.DRAFT);
        const separate = await product('external', hiddenBrand.id, [outside.id]);
        const cleared = await product('cleared', a.id, [child.id]);
        const variant = (
          productId: string,
          sizeId: string,
          price: number,
          weight: number,
          onHand: number,
          reserved = 0,
        ) =>
          db.productVariant.create({
            data: {
              productId,
              sizeId,
              salePriceToman: price,
              compareAtPriceToman: price + 10000,
              sku: `fixture-${randomUUID()}`,
              weightGrams: weight,
              lengthMm: 20,
              inventories: { create: { warehouseId: warehouse.id, onHand, reserved } },
            },
          });
        const mainVariant = await variant(main.id, sizeA.id, 100_000, 2.5, 3, 1);
        await variant(main.id, sizeB.id, 60_000, 1, 1, 1);
        await variant(main.id, sizeC.id, 200_000, 8, 1);
        await variant(second.id, sizeA.id, 130_000, 2.5, 1);
        await variant(unavailable.id, sizeA.id, 80_000, 2.5, 0);
        await variant(draft.id, sizeA.id, 50_000, 2.5, 1);
        await variant(separate.id, sizeA.id, 50_000, 2.5, 1);
        await variant(cleared.id, sizeA.id, 100_000, 2.5, 1);

        const code = `intended-for-${suffix}`;
        await db.catalogAttributeDefinition.create({
          data: {
            code,
            versions: {
              create: {
                version: 1,
                kind: CatalogAttributeKind.MULTI_SELECT,
                label: 'قابل استفاده برای',
                unit: CatalogAttributeUnit.NONE,
                source: CatalogAttributeSource.MANUAL,
                categoryIds: [root.id],
                options: [
                  { code: 'women', label: 'بانوان' },
                  { code: 'men', label: 'آقایان' },
                ],
                legacyMappings: [],
              },
            },
          },
        });
        await db.catalogProductAttributeValue.createMany({
          data: [
            {
              productId: main.id,
              attributeCode: code,
              definitionVersion: 1,
              revision: 1,
              value: { optionCodes: ['women'] },
            },
            {
              productId: second.id,
              attributeCode: code,
              definitionVersion: 1,
              revision: 1,
              value: { optionCodes: ['women', 'men'] },
            },
            {
              productId: cleared.id,
              attributeCode: code,
              definitionVersion: 1,
              revision: 1,
              value: { optionCodes: ['women'] },
            },
            { productId: cleared.id, attributeCode: code, definitionVersion: 1, revision: 2 },
          ],
        });
        const service = new CatalogService(
          {
            $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(db),
          } as unknown as PrismaService,
          {} as PublicMediaUrlService,
        );

        const query = {
          scopeCategory: root.slug,
          brands: [a.slug],
          categories: [child.slug, root.slug],
          attributes: [{ code, values: ['women'] }],
          sizeIds: [sizeA.id, sizeB.id],
          minWeightGrams: 2,
          maxWeightGrams: 3,
          maxPriceToman: 140_000,
          availability: PublicCatalogAvailability.IN_STOCK,
          pageSize: 1,
          sort: PublicCatalogSort.PRICE_ASC,
        };
        const result = await service.searchPublicCatalog(query);
        await expect(
          service.searchPublicCatalog({
            scopeCategory: root.slug,
            scopeCountry: country.slug,
            minWeightGrams: 2,
            maxWeightGrams: 3,
          }),
        ).resolves.toMatchObject({
          items: [{ id: main.id }],
          total: 1,
          facets: { brands: [{ value: a.slug, count: 1 }] },
        });
        expect(result).toMatchObject({
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
          items: [
            {
              id: main.id,
              salePriceToman: 100_000,
              compareAtPriceToman: 110_000,
              availableQuantity: 2,
              matchingVariants: [{ id: mainVariant.id, sizeId: sizeA.id }],
            },
          ],
          facets: {
            brands: [
              { value: a.slug, count: 1 },
              { value: b.slug, count: 1 },
            ],
            sizes: [{ value: sizeA.id, count: 1 }],
            priceToman: { min: 100_000, max: 100_000, count: 1 },
            weightGrams: { min: 2.5, max: 2.5, count: 1 },
            attributes: [{ code, options: [{ value: 'women', count: 1 }], range: null }],
          },
        });
        expect(result.facets.categories).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ value: root.slug, count: 1 }),
            expect.objectContaining({ value: child.slug, count: 1 }),
          ]),
        );
        await expect(service.searchPublicCatalog({ ...query, page: 2 })).resolves.toMatchObject({
          items: [],
          total: 1,
          totalPages: 1,
          facets: result.facets,
        });
        await expect(
          service.searchPublicCatalog({
            ...query,
            brands: [a.slug, b.slug],
            page: 2,
          }),
        ).resolves.toMatchObject({ items: [{ id: second.id }], total: 2 });
        await expect(
          service.searchPublicCatalog({
            scopeCategory: root.slug,
            categories: [outside.slug],
          }),
        ).resolves.toMatchObject({ items: [], total: 0 });
        await expect(
          service.searchPublicCatalog({
            scopeCategory: root.slug,
            sizeIds: [sizeA.id],
            minWeightGrams: 7,
          }),
        ).resolves.toMatchObject({ items: [], total: 0 });
        await expect(
          service.searchPublicCatalog({
            scopeCategory: root.slug,
            availability: PublicCatalogAvailability.OUT_OF_STOCK,
          }),
        ).resolves.toMatchObject({
          items: [{ id: unavailable.id, availableQuantity: 0, salePriceToman: null }],
          total: 1,
          facets: {
            availability: [
              { value: 'in-stock', count: 3 },
              { value: 'out-of-stock', count: 1 },
            ],
          },
        });
        await expect(
          service.searchPublicCatalog({
            scopeCategory: root.slug,
            attributes: [{ code, values: ['invalid'] }],
          }),
        ).rejects.toThrow('not supported by the current definition');
        await expect(
          service.searchPublicCatalog({ minPriceToman: 10, maxPriceToman: 9 }),
        ).rejects.toThrow('valid ranges');

        const checkoutWarehouse =
          (await db.warehouse.findFirst({
            where: { isDefault: true, isActive: true, deletedAt: null },
          })) ??
          (await db.warehouse.create({
            data: { name: 'Checkout fixture', code: `checkout-${suffix}`, isDefault: true },
          }));
        await db.inventory.create({
          data: { warehouseId: checkoutWarehouse.id, variantId: mainVariant.id, onHand: 1 },
        });
        const checkoutQuery = {
          ...query,
          checkoutStockOnly: true,
          brands: [a.slug, b.slug],
          minPriceToman: 1,
          sort: PublicCatalogSort.FEATURED,
        };
        await expect(service.searchPublicCatalog(checkoutQuery)).resolves.toMatchObject({
          total: 1,
          items: [{ id: main.id, availableQuantity: 1, salePriceToman: 100_000 }],
          facets: { priceToman: { min: 100_000, max: 100_000, count: 1 } },
        });
        await expect(
          service.searchPublicCatalog({ ...checkoutQuery, maxPriceToman: 90_000 }),
        ).resolves.toMatchObject({
          total: 0,
          items: [],
          facets: { priceToman: { min: 100_000, max: 100_000, count: 1 } },
        });
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
