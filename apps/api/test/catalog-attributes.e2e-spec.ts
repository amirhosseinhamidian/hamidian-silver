import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  CatalogAttributeKind as Kind,
  CatalogAttributeSource as Source,
  CatalogAttributeUnit as Unit,
  ProductPurchaseMode,
  ProductStatus,
  SizeMode,
  VariantInventoryMode,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import {
  CatalogAttributesService,
  readCurrentCatalogAttributeDefinitions,
} from '../src/modules/catalog/catalog-attributes.service';
import {
  applyCatalogQualityCandidate,
  findCatalogQualityProduct,
  inspectCatalogQualityProduct,
  loadQualityCategories,
  loadQualityValues,
} from '../src/modules/catalog/catalog-quality';
import { readMatchingCatalogVariants } from '../src/modules/catalog/catalog-variant-filter';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import type { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

describe('typed catalog attributes (PostgreSQL)', () => {
  let prisma: PrismaService;
  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function fixture(
    run: (transaction: Prisma.TransactionClient, suffix: string) => Promise<void>,
  ) {
    const rollback = new Error('Roll back catalog attribute fixtures');
    try {
      await prisma.$transaction(
        async (transaction) => {
          await run(transaction, randomUUID());
          throw rollback;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it('applies only the reviewed diff once and retains an explicit clear', async () => {
    await fixture(async (transaction, suffix) => {
      const category = await transaction.category.create({
        data: { name: 'Quality', slug: `quality-${suffix}` },
      });
      const product = await transaction.product.create({
        data: {
          name: 'Quality fixture',
          slug: `quality-product-${suffix}`,
          categories: { create: { categoryId: category.id } },
          attributes: { create: { key: 'عیار', value: '۹۲۵', sortOrder: 1 } },
        },
      });
      const scoped = {
        $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          run(transaction),
        $queryRaw: transaction.$queryRaw.bind(transaction),
        category: transaction.category,
        product: transaction.product,
        productVariant: transaction.productVariant,
        catalogAttributeDefinition: transaction.catalogAttributeDefinition,
        catalogProductAttributeValue: transaction.catalogProductAttributeValue,
      } as unknown as PrismaService;
      const code = `quality-${suffix}`;
      const service = new CatalogAttributesService(scoped);
      await service.createDefinition({
        code,
        label: 'عیار',
        kind: Kind.NUMBER,
        unit: Unit.PER_MILLE,
        source: Source.MANUAL,
        isActive: true,
        isRequired: true,
        sortOrder: 1,
        categoryIds: [category.id],
        excludedCategoryIds: [],
        options: [],
        legacyMappings: [{ legacyValue: '۹۲۵', value: { number: 925, unit: Unit.PER_MILLE } }],
      });
      expect(await service.listProductValues(product.id)).toEqual([
        expect.objectContaining({ needsCompletion: true }),
      ]);
      const rules = [{ source: 'catalog', key: 'عیار', code }];
      const [row, definitions, categories, values] = await Promise.all([
        findCatalogQualityProduct(transaction, product.id),
        readCurrentCatalogAttributeDefinitions(transaction),
        loadQualityCategories(transaction),
        loadQualityValues(transaction, [product.id]),
      ]);
      if (!row) throw new Error('Expected a catalog product');
      const candidate = inspectCatalogQualityProduct(
        row,
        definitions,
        categories,
        values.get(product.id),
        rules,
      ).attributes[0]?.candidate;
      expect(candidate).toMatchObject({
        state: 'candidate',
        before: null,
        after: { number: 925 },
        approved: false,
      });
      if (!candidate) throw new Error('Expected a candidate');
      const reviewed = { ...candidate, productId: product.id };
      await expect(
        applyCatalogQualityCandidate(scoped, rules, { ...reviewed, after: { number: 950 } }),
      ).resolves.toBe('preview-changed');
      const legacyAttribute = { productId_key: { productId: product.id, key: 'عیار' } };
      await transaction.productAttribute.update({ where: legacyAttribute, data: { value: '۹۵۰' } });
      await expect(applyCatalogQualityCandidate(scoped, rules, reviewed)).resolves.toBe(
        'preview-changed',
      );
      await transaction.productAttribute.update({ where: legacyAttribute, data: { value: '۹۲۵' } });
      await expect(applyCatalogQualityCandidate(scoped, rules, reviewed)).resolves.toBe('applied');
      expect(await service.listProductValues(product.id)).toEqual([
        expect.objectContaining({ needsCompletion: false }),
      ]);
      await expect(applyCatalogQualityCandidate(scoped, rules, reviewed)).resolves.toBe(
        'revision-exists',
      );
      await service.setProductValue(product.id, code, {
        definitionVersion: 1,
        expectedRevision: 1,
        clear: true,
      });
      await expect(applyCatalogQualityCandidate(scoped, rules, reviewed)).resolves.toBe(
        'revision-exists',
      );
      expect(
        await transaction.catalogProductAttributeValue.count({
          where: { productId: product.id, attributeCode: code },
        }),
      ).toBe(2);
    });
  }, 20000);

  it('retains legacy mappings and prior value revisions across a definition update', async () => {
    await fixture(async (transaction, suffix) => {
      const root = await transaction.category.create({
        data: { name: 'Parent', slug: `root-${suffix}` },
      });
      const child = await transaction.category.create({
        data: { name: 'Child', slug: `child-${suffix}`, parentId: root.id },
      });
      const product = await transaction.product.create({
        data: { name: 'Fixture', slug: `product-${suffix}`, status: ProductStatus.ACTIVE },
      });
      await transaction.productCategory.create({
        data: { productId: product.id, categoryId: child.id },
      });
      const service = new CatalogAttributesService({
        $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          run(transaction),
        category: transaction.category,
        product: transaction.product,
        catalogAttributeDefinition: transaction.catalogAttributeDefinition,
        catalogProductAttributeValue: transaction.catalogProductAttributeValue,
      } as unknown as PrismaService);
      const code = `fineness-${suffix}`;
      const config = {
        label: 'عیار',
        kind: Kind.NUMBER,
        unit: Unit.PER_MILLE,
        source: Source.MANUAL,
        isActive: true,
        sortOrder: 1,
        categoryIds: [root.id],
        excludedCategoryIds: [],
        options: [],
        legacyMappings: [{ legacyValue: 'نقره ۹۲۵', value: { number: 925, unit: Unit.PER_MILLE } }],
      };
      await service.createDefinition({ ...config, code });
      const first = await service.setProductValue(product.id, code, {
        definitionVersion: 1,
        expectedRevision: 0,
        legacyValue: ' نقره ۹۲۵ ',
      });
      expect(first).toMatchObject({
        revision: 1,
        value: { number: 925, unit: Unit.PER_MILLE },
        legacyValue: 'نقره ۹۲۵',
      });
      await service.updateDefinition(code, { ...config, label: 'عیار نقره', expectedVersion: 1 });
      await expect(
        service.setProductValue(product.id, code, {
          definitionVersion: 1,
          expectedRevision: 1,
          value: { number: 950, unit: Unit.PER_MILLE },
        }),
      ).rejects.toThrow('has changed');
      await expect(
        service.setProductValue(product.id, code, {
          definitionVersion: 2,
          expectedRevision: 1,
          value: { number: 950, unit: Unit.GRAM },
        }),
      ).rejects.toThrow('does not match');
      await service.setProductValue(product.id, code, {
        definitionVersion: 2,
        expectedRevision: 1,
        value: { number: 950, unit: Unit.PER_MILLE },
      });
      expect(
        await transaction.catalogProductAttributeValue.findMany({
          where: { productId: product.id, attributeCode: code },
          orderBy: { revision: 'asc' },
          select: { revision: true, definitionVersion: true },
        }),
      ).toEqual([
        { revision: 1, definitionVersion: 1 },
        { revision: 2, definitionVersion: 2 },
      ]);
      expect(await service.listPublicValues(product.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code,
            label: 'عیار نقره',
            value: { number: 950, unit: Unit.PER_MILLE },
          }),
        ]),
      );
    });
  }, 20000);

  it('requires size, length and availability to match the same variant including bundles', async () => {
    await fixture(async (transaction, suffix) => {
      const catalog = new CatalogService(
        transaction as unknown as PrismaService,
        {} as PublicMediaUrlService,
      );
      const name = `Sized ${suffix}`;
      const product = await transaction.product.create({
        data: {
          name,
          slug: `sized-${suffix}`,
          status: ProductStatus.ACTIVE,
          sizeMode: SizeMode.SIZED,
        },
      });
      const group = await transaction.sizeGroup.create({
        data: {
          name: 'Fixture',
          code: `fixture-${suffix}`,
          selectionLabel: 'Size',
          cartLabel: 'Size',
        },
      });
      const small = await transaction.size.create({
        data: { groupId: group.id, code: 'S', label: 'Small' },
      });
      const large = await transaction.size.create({
        data: { groupId: group.id, code: 'L', label: 'Large' },
      });
      const unavailable = await transaction.productVariant.create({
        data: {
          productId: product.id,
          sku: `small-${suffix}`,
          sizeId: small.id,
          lengthMm: 220,
          salePriceToman: 100,
        },
      });
      const available = await transaction.productVariant.create({
        data: {
          productId: product.id,
          sku: `large-${suffix}`,
          sizeId: large.id,
          lengthMm: 240,
          salePriceToman: 200,
        },
      });
      const warehouse = await transaction.warehouse.create({
        data: { name: 'Stock', code: `stock-${suffix}` },
      });
      const closed = await transaction.warehouse.create({
        data: { name: 'Closed', code: `closed-${suffix}`, isActive: false },
      });
      await transaction.inventory.createMany({
        data: [
          { warehouseId: warehouse.id, variantId: unavailable.id, onHand: 1, reserved: 1 },
          { warehouseId: closed.id, variantId: unavailable.id, onHand: 8 },
          { warehouseId: warehouse.id, variantId: available.id, onHand: 3, reserved: 1 },
        ],
      });
      expect(
        (await readMatchingCatalogVariants(transaction, { sizeId: small.id }))?.has(product.id),
      ).toBe(false);
      expect(
        (
          await readMatchingCatalogVariants(transaction, { sizeId: large.id, maxLengthMm: 225 })
        )?.has(product.id),
      ).toBe(false);
      expect(
        (
          await readMatchingCatalogVariants(transaction, { sizeId: large.id, minLengthMm: 230 })
        )?.get(product.id),
      ).toEqual({
        availableQuantity: 2,
        variants: [{ id: available.id, sizeId: large.id, lengthMm: 240, availableQuantity: 2 }],
      });
      const query = { sizeId: large.id, minLengthMm: 230 };
      for (const filter of [query, { ...query, q: name }]) {
        expect(await catalog.listPublicProducts(filter)).toMatchObject({
          total: 1,
          items: [
            {
              id: product.id,
              salePriceToman: 200,
              availableQuantity: 2,
              matchingVariants: [{ id: available.id, availableQuantity: 2 }],
            },
          ],
        });
      }

      const bundleCategory = await transaction.category.create({
        data: { name: 'Bundle fixture', slug: `bundle-category-${suffix}` },
      });
      const bundleProduct = await transaction.product.create({
        data: {
          name: `Bundle ${suffix}`,
          slug: `bundle-${suffix}`,
          status: ProductStatus.ACTIVE,
          purchaseMode: ProductPurchaseMode.COMPOSITE,
          categories: { create: { categoryId: bundleCategory.id } },
        },
      });
      const component = await transaction.productVariant.create({
        data: { productId: bundleProduct.id, sku: `part-${suffix}` },
      });
      const bundle = await transaction.productVariant.create({
        data: {
          productId: bundleProduct.id,
          sku: `bundle-${suffix}`,
          lengthMm: 260,
          inventoryMode: VariantInventoryMode.COMPONENTS,
        },
      });
      await transaction.productVariantComponent.create({
        data: { bundleVariantId: bundle.id, componentVariantId: component.id, quantity: 2 },
      });
      const stock = await transaction.inventory.create({
        data: { warehouseId: warehouse.id, variantId: component.id, onHand: 3, reserved: 1 },
      });
      const secondComponent = await transaction.productVariant.create({
        data: { productId: bundleProduct.id, sku: `other-part-${suffix}` },
      });
      await transaction.inventory.create({
        data: { warehouseId: warehouse.id, variantId: secondComponent.id, onHand: 2 },
      });
      expect(await catalog.getPublicProduct(bundleProduct.slug)).toMatchObject({
        availableQuantity: 2,
      });
      for (const filters of [
        { category: bundleCategory.slug },
        { category: bundleCategory.slug, q: bundleProduct.name },
      ]) {
        const listing = await catalog.listPublicProducts(filters);
        expect(listing.items.find(({ id }) => id === bundleProduct.id)).toMatchObject({
          availableQuantity: 2,
        });
      }
      expect(
        (await readMatchingCatalogVariants(transaction, { minLengthMm: 260 }))?.get(
          bundleProduct.id,
        )?.variants[0],
      ).toMatchObject({ id: bundle.id, availableQuantity: 1 });
      await transaction.inventory.update({ where: { id: stock.id }, data: { reserved: 2 } });
      expect(
        (await readMatchingCatalogVariants(transaction, { minLengthMm: 260 }))?.has(
          bundleProduct.id,
        ),
      ).toBe(false);
    });
  }, 20000);
});
