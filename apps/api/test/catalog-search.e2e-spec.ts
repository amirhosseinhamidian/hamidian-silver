import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  CatalogAttributeKind,
  CatalogAttributeSource,
  CatalogAttributeUnit,
  ProductStatus,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('ranks bilingual catalog matches and records only bounded aggregate terms', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back search fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const root = await db.category.create({
          data: { name: 'زیورآلات نمونه', slug: `search-category-${suffix}` },
        });
        const brand = await db.brand.create({
          data: { name: 'نشان آزمایشی', slug: `search-brand-${suffix}` },
        });
        const product = (
          name: string,
          slug: string,
          status: ProductStatus = ProductStatus.ACTIVE,
        ) =>
          db.product.create({
            data: {
              name,
              slug,
              status,
              brandId: brand.id,
              categories: { create: { categoryId: root.id } },
            },
          });
        const ring = await product('انگشتر نقره ۹۲۵', `ruby-model-${suffix}`);
        const mediaBaseUrl = 'https://media.example.test/media';
        const storageKey = `catalog/search-${suffix}.webp`;
        const media = await db.media.create({
          data: { storageKey, mimeType: 'image/webp', sizeBytes: 128 },
        });
        await db.productMedia.create({
          data: { productId: ring.id, mediaId: media.id, isPrimary: true },
        });
        const material = await product('زیور مخمل', `velvet-fixture-${suffix}`);
        const cleared = await product('قطعه صدف', `shell-fixture-${suffix}`);
        await product('Silver ring 925', `draft-silver-${suffix}`, ProductStatus.DRAFT);
        const code = `fineness-${suffix}`;
        await db.catalogAttributeDefinition.create({
          data: {
            code,
            versions: {
              create: {
                version: 1,
                kind: CatalogAttributeKind.NUMBER,
                unit: CatalogAttributeUnit.PER_MILLE,
                source: CatalogAttributeSource.MANUAL,
                label: 'عیار',
                categoryIds: [root.id],
                options: [],
                legacyMappings: [],
              },
            },
          },
        });
        await db.catalogProductAttributeValue.createMany({
          data: [
            ...[material, cleared].map(({ id }) => ({
              productId: id,
              attributeCode: code,
              definitionVersion: 1,
              revision: 1,
              value: { number: 925, unit: CatalogAttributeUnit.PER_MILLE },
            })),
            { productId: cleared.id, attributeCode: code, definitionVersion: 1, revision: 2 },
          ],
        });

        const service = new CatalogService(
          {
            $transaction: (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(db),
            $queryRaw: db.$queryRaw.bind(db),
            $executeRaw: db.$executeRaw.bind(db),
            product: db.product,
          } as unknown as PrismaService,
          new PublicMediaUrlService(new ConfigService({ MEDIA_PUBLIC_BASE_URL: mediaBaseUrl })),
        );
        const search = (q: string, page?: number) =>
          service.searchPublicCatalog({ scopeCategory: root.slug, q, page });
        const [{ day: period }] = await db.$queryRaw<{ day: Date }[]>`
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS day
      `;
        const readCount = (term: string) =>
          db.catalogSearchDaily.findUnique({
            where: { day_term: { day: period, term } },
          });
        const before = await readCount('925 انگشتر نقره');
        const bilingual = await search('Ring Silver ۹٢۵');
        expect(bilingual.items[0]?.id).toBe(ring.id);
        expect((await search('انگشتر‌ نقره 925')).items[0]?.id).toBe(ring.id);
        expect((await search(ring.slug)).items[0]?.id).toBe(ring.id);
        const byAttribute = await search('عیار ۹۲۵');
        expect(byAttribute.items.map(({ id }) => id)).toContain(material.id);
        expect(byAttribute.items.map(({ id }) => id)).not.toContain(cleared.id);
        expect((await service.listPublicProductSuggestions(brand.slug)).brands[0]?.id).toBe(
          brand.id,
        );
        expect((await service.listPublicProductSuggestions(root.slug)).categories[0]?.id).toBe(
          root.id,
        );
        const suggestions = await service.listPublicProductSuggestions(ring.slug);
        expect(suggestions.items.find(({ id }) => id === ring.id)?.primaryMedia).toMatchObject({
          url: `${mediaBaseUrl}/${storageKey}`,
          mimeType: 'image/webp',
        });

        await search('Silver ring 925', 2);
        await service.listPublicProductSuggestions('Silver ring 925');
        expect(await readCount('925 انگشتر نقره')).toMatchObject({
          searches: (before?.searches ?? 0n) + 2n,
          withoutResult: before?.withoutResult ?? 0n,
        });

        const other = await readCount('other');
        await expect(search('%_')).resolves.toMatchObject({ total: 0, items: [] });
        expect(await readCount('other')).toMatchObject({
          searches: (other?.searches ?? 0n) + 1n,
          withoutResult: (other?.withoutResult ?? 0n) + 1n,
        });
        expect(await readCount('%')).toBeNull();
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
