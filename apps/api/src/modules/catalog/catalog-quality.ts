import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { CatalogAttributeSource, ProductStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { completionVariantSelect, readAttributeCompletion } from './catalog-attribute-completion';
import {
  attributeAppliesToCategories,
  normalizeLegacyAttributeValue,
} from './catalog-attribute-values';
import {
  CatalogAttributesService,
  readCurrentCatalogAttributeDefinitions,
} from './catalog-attributes.service';
import { catalogHierarchyTransaction } from './catalog-hierarchy-transaction';
import type {
  CatalogAttributeDefinitionDto,
  CatalogAttributeValueDto,
} from './dto/catalog-attribute.dto';

export type AttributeSourceRule = Readonly<{ source: string; key: string; code: string }>;
type Evidence = Readonly<{ source: string; key: string; legacyValue: string }>;
export type CatalogQualityCandidate = Readonly<{
  code: string;
  definitionVersion: number;
  state: 'candidate' | 'review';
  evidence: readonly Evidence[];
  before: null;
  after: CatalogAttributeValueDto | null;
  fingerprint: string;
  approved: boolean;
}>;

const qualityProductSelect = {
  id: true,
  slug: true,
  status: true,
  sizeMode: true,
  categories: { select: { categoryId: true }, orderBy: { categoryId: 'asc' } },
  attributes: { select: { key: true, value: true }, orderBy: { key: 'asc' } },
  variants: { where: { isActive: true, deletedAt: null }, select: completionVariantSelect },
  supplierImportDraft: {
    select: {
      attributes: true,
      supplierSource: { select: { supplier: { select: { code: true } } } },
    },
  },
} as const satisfies Prisma.ProductSelect;

type QualityProduct = Prisma.ProductGetPayload<{ select: typeof qualityProductSelect }>;
type StoredAttribute = CatalogAttributeValueDto | null;
type Category = { id: string; slug: string; parentId: string | null };
type QualityReader = Pick<PrismaClient, '$queryRaw' | 'product' | 'category'>;

const qualityProductsWhere = {
  deletedAt: null,
  status: { in: [ProductStatus.ACTIVE, ProductStatus.DRAFT] },
} satisfies Prisma.ProductWhereInput;

export function findCatalogQualityProducts(reader: QualityReader, take: number, after?: string) {
  return reader.product.findMany({
    where: { ...qualityProductsWhere, ...(after ? { id: { gt: after } } : {}) },
    select: qualityProductSelect,
    orderBy: { id: 'asc' },
    take,
  });
}

export function findCatalogQualityProduct(reader: QualityReader, id: string) {
  return reader.product.findFirst({
    where: { ...qualityProductsWhere, id },
    select: qualityProductSelect,
  });
}

export async function loadQualityCategories(reader: Pick<QualityReader, 'category'>) {
  const rows = await reader.category.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, slug: true, parentId: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadQualityValues(reader: QualityReader, ids: readonly string[]) {
  const products = new Map<string, Map<string, StoredAttribute>>();
  if (ids.length === 0) return products;
  const rows = await reader.$queryRaw<
    {
      productId: string;
      attributeCode: string;
      value: CatalogAttributeValueDto | null;
    }[]
  >(Prisma.sql`
    SELECT DISTINCT ON ("productId", "attributeCode") "productId", "attributeCode", revision, value
    FROM "catalog_product_attribute_values"
    WHERE "productId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "productId", "attributeCode", revision DESC
  `);
  for (const { productId, attributeCode, value } of rows) {
    const product = products.get(productId) ?? new Map<string, StoredAttribute>();
    product.set(attributeCode, value);
    products.set(productId, product);
  }
  return products;
}

function extractSupplierEvidence(input: unknown): { key: string; value: string }[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (entry): entry is { key: string; value: string } =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.key === 'string' &&
      typeof entry.value === 'string' &&
      entry.key.trim().length > 0 &&
      entry.value.trim().length > 0 &&
      entry.value.trim().length <= 500,
  );
}

export function buildCatalogQualityCandidate(
  productId: string,
  definition: CatalogAttributeDefinitionDto,
  evidence: readonly Evidence[],
): CatalogQualityCandidate | undefined {
  if (evidence.length === 0) return undefined;
  const aliases = new Map(
    definition.legacyMappings.map(({ legacyValue, value }) => [
      normalizeLegacyAttributeValue(legacyValue),
      value,
    ]),
  );
  const values = evidence.map(({ legacyValue }) =>
    aliases.get(normalizeLegacyAttributeValue(legacyValue)),
  );
  const first = values[0];
  const after =
    first && values.every((value) => JSON.stringify(value) === JSON.stringify(first))
      ? first
      : null;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([productId, definition.code, definition.version, evidence, after]))
    .digest('hex');
  return {
    code: definition.code,
    definitionVersion: definition.version,
    state: after ? 'candidate' : 'review',
    evidence,
    before: null,
    after,
    fingerprint,
    approved: false,
  };
}

export function inspectCatalogQualityProduct(
  product: QualityProduct,
  definitions: readonly CatalogAttributeDefinitionDto[],
  categories: ReadonlyMap<string, Category>,
  stored: ReadonlyMap<string, StoredAttribute> | undefined,
  rules: readonly AttributeSourceRule[],
) {
  const memberships = product.categories.flatMap(({ categoryId }) =>
    categories.has(categoryId) ? [categoryId] : [],
  );
  const source = product.supplierImportDraft
    ? `supplier:${product.supplierImportDraft.supplierSource.supplier.code}`
    : 'catalog';
  const evidence = [
    ...product.attributes.map(({ key, value }) => ({
      source: 'catalog',
      key,
      legacyValue: value.trim(),
    })),
    ...extractSupplierEvidence(product.supplierImportDraft?.attributes).map(({ key, value }) => ({
      source,
      key,
      legacyValue: value.trim(),
    })),
  ].sort(
    (left, right) =>
      left.source.localeCompare(right.source) ||
      left.key.localeCompare(right.key) ||
      left.legacyValue.localeCompare(right.legacyValue),
  );
  const attributes = definitions.flatMap((definition) => {
    const categorySlugs = memberships.flatMap((id) =>
      attributeAppliesToCategories(definition, [id], categories) ? [categories.get(id)!.slug] : [],
    );
    if (categorySlugs.length === 0) return [];
    const prior = stored?.get(definition.code);
    const completion = readAttributeCompletion(definition, product, prior);
    if (completion === 'not-applicable') return [];
    return [
      {
        code: definition.code,
        categorySlugs,
        required: definition.isRequired === true,
        completion,
        candidate:
          prior === undefined && definition.source === CatalogAttributeSource.MANUAL
            ? buildCatalogQualityCandidate(
                product.id,
                definition,
                evidence.filter((item) =>
                  rules.some(
                    (rule) =>
                      rule.code === definition.code &&
                      rule.source === item.source &&
                      rule.key === normalizeLegacyAttributeValue(item.key),
                  ),
                ),
              )
            : undefined,
      },
    ];
  });
  return { id: product.id, slug: product.slug, status: product.status, source, attributes };
}

export function applyCatalogQualityCandidate(
  prisma: PrismaService,
  rules: readonly AttributeSourceRule[],
  reviewed: Readonly<{
    productId: string;
    code: string;
    fingerprint: string;
    evidence: unknown;
    after: unknown;
    definitionVersion: unknown;
  }>,
) {
  const { productId, code } = reviewed;
  return catalogHierarchyTransaction(prisma, async (transaction) => {
    const [product, definitions, categories, values] = await Promise.all([
      findCatalogQualityProduct(transaction, productId),
      readCurrentCatalogAttributeDefinitions(transaction),
      loadQualityCategories(transaction),
      loadQualityValues(transaction, [productId]),
    ]);
    const stored = values.get(productId);
    if (stored?.has(code)) return 'revision-exists';
    if (!product) return 'product-unavailable';
    const live = inspectCatalogQualityProduct(
      product,
      definitions,
      categories,
      stored,
      rules,
    ).attributes.find((attribute) => attribute.code === code)?.candidate;
    if (
      !live?.after ||
      live.fingerprint !== reviewed.fingerprint ||
      live.definitionVersion !== reviewed.definitionVersion ||
      JSON.stringify(live.evidence) !== JSON.stringify(reviewed.evidence) ||
      JSON.stringify(live.after) !== JSON.stringify(reviewed.after)
    )
      return 'preview-changed';
    const evidence = live.evidence[0];
    if (!evidence) return 'preview-changed';
    await new CatalogAttributesService(prisma).writeProductValue(transaction, productId, code, {
      definitionVersion: live.definitionVersion,
      expectedRevision: 0,
      legacyValue: evidence.legacyValue,
    });
    return 'applied';
  });
}
