import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import { ProductStatus, SeoRedirectEntityType } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PERMISSION_CODES } from '../src/modules/authorization/rbac.constants';
import { CatalogCategoriesService } from '../src/modules/catalog/catalog-categories.service';
import { readActiveCategoryProductCounts } from '../src/modules/catalog/catalog-category-counts';
import type { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

describe('catalog category hierarchy (PostgreSQL)', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('counts unique active descendants and keeps memberships and URLs after a merge', async () => {
    const rollback = new Error('Roll back the catalog fixture');
    try {
      await prisma.$transaction(
        async (transaction) => {
          const suffix = randomUUID();
          const root = await transaction.category.create({
            data: { name: 'Root', slug: `root-${suffix}` },
          });
          const source = await transaction.category.create({
            data: { name: 'Source', slug: `source-${suffix}`, parentId: root.id },
          });
          const target = await transaction.category.create({
            data: { name: 'Target', slug: `target-${suffix}`, parentId: root.id },
          });
          const leaf = await transaction.category.create({
            data: { name: 'Leaf', slug: `leaf-${suffix}`, parentId: source.id },
          });
          const hidden = await transaction.category.create({
            data: { name: 'Hidden', slug: `hidden-${suffix}`, parentId: root.id, isActive: false },
          });
          const firstId = randomUUID();
          const secondId = randomUUID();
          const draftId = randomUUID();
          const hiddenProductId = randomUUID();
          await transaction.product.createMany({
            data: [
              { id: firstId, name: 'First', slug: `first-${suffix}`, status: ProductStatus.ACTIVE },
              {
                id: secondId,
                name: 'Second',
                slug: `second-${suffix}`,
                status: ProductStatus.ACTIVE,
                primaryCategoryId: source.id,
              },
              { id: draftId, name: 'Draft', slug: `draft-${suffix}`, status: ProductStatus.DRAFT },
              {
                id: hiddenProductId,
                name: 'Hidden',
                slug: `hidden-product-${suffix}`,
                status: ProductStatus.ACTIVE,
              },
            ],
          });
          await transaction.productCategory.createMany({
            data: [
              { productId: firstId, categoryId: source.id },
              { productId: firstId, categoryId: target.id },
              { productId: firstId, categoryId: leaf.id },
              { productId: secondId, categoryId: source.id },
              { productId: draftId, categoryId: leaf.id },
              { productId: hiddenProductId, categoryId: hidden.id },
            ],
          });
          const historicalPath = `/categories/history-${suffix}`;
          await transaction.seoRedirect.create({
            data: {
              sourcePath: historicalPath,
              destinationPath: `/categories/${source.slug}`,
              entityType: SeoRedirectEntityType.CATEGORY,
              entityId: source.id,
            },
          });

          const before = await readActiveCategoryProductCounts(transaction);
          expect(before.get(root.id)).toEqual({
            activeProductCount: 0,
            activeSubtreeProductCount: 2,
          });
          expect(before.get(leaf.id)).toEqual({
            activeProductCount: 1,
            activeSubtreeProductCount: 1,
          });
          expect(before.has(hidden.id)).toBe(false);

          // Run the service against the same rollback-only PostgreSQL fixture.
          const service = new CatalogCategoriesService(
            {
              $transaction: (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
                fn(transaction),
            } as unknown as PrismaService,
            {} as PublicMediaUrlService,
          );
          const result = await service.merge(
            source.id,
            { targetCategoryId: target.id, dryRun: false },
            [
              PERMISSION_CODES.CATALOG_WRITE,
              PERMISSION_CODES.CMS_WRITE,
              PERMISSION_CODES.SETTINGS_WRITE,
            ],
          );
          expect(result).toMatchObject({
            merged: true,
            sourceProductCount: 2,
            targetProductCount: 1,
            sharedProductCount: 1,
          });
          const after = await readActiveCategoryProductCounts(transaction);
          expect(after.get(root.id)).toEqual(before.get(root.id));
          expect(after.get(target.id)).toEqual({
            activeProductCount: 2,
            activeSubtreeProductCount: 2,
          });
          expect(after.has(source.id)).toBe(false);
          expect(
            await transaction.productCategory.count({ where: { categoryId: source.id } }),
          ).toBe(0);
          expect(await transaction.category.findUnique({ where: { id: leaf.id } })).toMatchObject({
            slug: leaf.slug,
            parentId: target.id,
          });
          expect(await transaction.product.findUnique({ where: { id: secondId } })).toMatchObject({
            primaryCategoryId: target.id,
          });
          for (const sourcePath of [result.sourcePath, historicalPath]) {
            expect(
              await transaction.seoRedirect.findUnique({ where: { sourcePath } }),
            ).toMatchObject({
              destinationPath: result.targetPath,
              entityId: target.id,
            });
          }

          throw rollback;
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 20_000);
});
