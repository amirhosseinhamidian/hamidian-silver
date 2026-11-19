import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { readCurrentCatalogAttributeDefinitions } from '../src/modules/catalog/catalog-attributes.service';
import { normalizeLegacyAttributeValue } from '../src/modules/catalog/catalog-attribute-values';
import { publicCatalogProductWhere } from '../src/modules/catalog/catalog-public-availability';
import {
  applyCatalogQualityCandidate,
  findCatalogQualityProducts,
  inspectCatalogQualityProduct,
  loadQualityCategories,
  loadQualityValues,
  type AttributeSourceRule,
} from '../src/modules/catalog/catalog-quality';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const manifestVersion = 1;

function print(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('An object is required in the catalog quality input.');
  return input as Record<string, unknown>;
}

async function jsonFile(path: string): Promise<unknown> {
  if ((await stat(path)).size > 5 * 1024 * 1024)
    throw new Error('The catalog quality file exceeds 5 MiB.');
  return JSON.parse(await readFile(path, 'utf8'));
}

function readRules(input: unknown): AttributeSourceRule[] {
  if (!Array.isArray(input) || input.length > 250)
    throw new Error('The mapping must contain an array of up to 250 rules.');
  return input.map((entry) => {
    const { source, key, code } = record(entry);
    if (
      typeof source !== 'string' ||
      !/^(catalog|supplier:[^\s:]{1,64})$/.test(source) ||
      typeof key !== 'string' ||
      key.length > 150 ||
      !normalizeLegacyAttributeValue(key) ||
      typeof code !== 'string' ||
      code.length > 64 ||
      !codePattern.test(code)
    ) {
      throw new Error(
        'A mapping rule needs a catalog or supplier source, a field key and an attribute code.',
      );
    }
    return { source, key: normalizeLegacyAttributeValue(key), code };
  });
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
    throw new Error(`Expected an integer from ${min} to ${max}.`);
  return Number(value);
}

async function scan(
  prisma: PrismaService,
  mode: 'audit' | 'preview',
  take: number,
  after: string | undefined,
  rules: AttributeSourceRule[],
) {
  const [definitions, categories] = await Promise.all([
    readCurrentCatalogAttributeDefinitions(prisma),
    loadQualityCategories(prisma),
  ]);
  if (rules.some(({ code }) => !definitions.some((definition) => definition.code === code))) {
    throw new Error('A mapping rule points to an unknown catalog attribute code.');
  }
  const groups = new Map<
    string,
    {
      category: string;
      source: string;
      status: string;
      code: string;
      required: boolean;
      complete: number;
      missing: number;
    }
  >();
  const missingCategories = new Map<string, number>();
  let productsScanned = 0;
  let cursor = after;
  for (;;) {
    const rows = await findCatalogQualityProducts(prisma, take, cursor);
    const values = await loadQualityValues(
      prisma,
      rows.map(({ id }) => id),
    );
    const products = rows.map((row) =>
      inspectCatalogQualityProduct(row, definitions, categories, values.get(row.id), rules),
    );
    const nextAfter = rows.length === take ? rows.at(-1)?.id : undefined;
    if (mode === 'preview') {
      print({
        version: manifestVersion,
        nextAfter: nextAfter ?? null,
        productsScanned: products.length,
        rules,
        changes: products.flatMap(({ id: productId, slug, attributes }) =>
          attributes.flatMap(({ candidate }) =>
            candidate ? [{ productId, slug, ...candidate }] : [],
          ),
        ),
      });
      return;
    }
    for (const { source, status, attributes } of products) {
      for (const { code, categorySlugs, required, completion } of attributes) {
        for (const category of categorySlugs) {
          const key = JSON.stringify([category, source, status, code]);
          const group = groups.get(key) ?? {
            category,
            source,
            status,
            code,
            required,
            complete: 0,
            missing: 0,
          };
          group[completion]++;
          groups.set(key, group);
        }
      }
    }
    for (const [index, row] of rows.entries()) {
      if (row.categories.some(({ categoryId }) => categories.has(categoryId))) continue;
      const source = products[index]!.source;
      missingCategories.set(source, (missingCategories.get(source) ?? 0) + 1);
    }
    productsScanned += rows.length;
    if (!nextAfter) break;
    cursor = nextAfter;
  }
  const emptyBrands = await prisma.brand.findMany({
    where: { isActive: true, deletedAt: null, products: { none: publicCatalogProductWhere } },
    select: { slug: true },
    orderBy: { slug: 'asc' },
  });
  print({
    productsScanned,
    emptyBrandSlugs: emptyBrands.map(({ slug }) => slug),
    missingActiveCategoryBySource: Object.fromEntries(missingCategories),
    groups: [...groups.values()].map((group) => ({
      ...group,
      applicable: group.complete + group.missing,
      completionRate: group.complete / (group.complete + group.missing),
    })),
  });
}

async function apply(prisma: PrismaService, input: unknown, take: number, offset: number) {
  const manifest = record(input);
  if (manifest.version !== manifestVersion || !Array.isArray(manifest.changes))
    throw new Error('This is not a catalog quality preview.');
  const rules = readRules(manifest.rules);
  const ending = Math.min(offset + take, manifest.changes.length);
  const results: { row: number; result: string }[] = [];
  for (let row = offset; row < ending; row++) {
    const entry = record(manifest.changes[row]);
    if (entry.approved !== true) {
      results.push({ row, result: 'not-approved' });
      continue;
    }
    const { productId, code, fingerprint } = entry;
    if (
      entry.state !== 'candidate' ||
      typeof productId !== 'string' ||
      !uuid.test(productId) ||
      typeof code !== 'string' ||
      !codePattern.test(code) ||
      typeof fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(fingerprint)
    ) {
      results.push({ row, result: 'invalid-candidate' });
      continue;
    }
    try {
      const result = await applyCatalogQualityCandidate(prisma, rules, {
        productId,
        code,
        fingerprint,
        evidence: entry.evidence,
        after: entry.after,
        definitionVersion: entry.definitionVersion,
      });
      results.push({ row, result });
    } catch (error) {
      if (error instanceof ConflictException) {
        print({ results, nextOffset: row, interruptedBy: 'concurrent-change' });
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  }
  print({ results, nextOffset: ending < manifest.changes.length ? ending : null });
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      'batch-size': { type: 'string' },
      after: { type: 'string' },
      offset: { type: 'string' },
      rules: { type: 'string' },
      plan: { type: 'string' },
      apply: { type: 'boolean' },
    },
  });
  const [mode] = positionals;
  if (positionals.length !== 1 || (mode !== 'audit' && mode !== 'preview' && mode !== 'apply')) {
    throw new Error(
      'Usage: catalog:quality audit | preview --rules FILE [--after UUID] | apply --plan FILE --apply [--offset N]',
    );
  }
  const take = boundedInteger(values['batch-size'], 50, 1, 100);
  if (values.after && !uuid.test(values.after))
    throw new Error('The continuation cursor must be a product UUID.');
  if (mode === 'apply') {
    if (!values.apply || !values.plan || values.after || values.rules)
      throw new Error('Apply requires --plan and --apply. Resume with --offset.');
  } else if (
    values.apply ||
    values.plan ||
    values.offset ||
    (mode === 'preview' && !values.rules)
  ) {
    throw new Error('Audit and preview are read-only. Preview requires --rules.');
  }
  const databaseUrl = process.env.CATALOG_QUALITY_DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error('Set CATALOG_QUALITY_DATABASE_URL explicitly.');
  const prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
  try {
    if (mode === 'apply' && values.plan) {
      await apply(
        prisma,
        await jsonFile(values.plan),
        take,
        boundedInteger(values.offset, 0, 0, 100_000),
      );
    } else if (mode === 'audit' || mode === 'preview') {
      const rules = values.rules ? readRules(await jsonFile(values.rules)) : [];
      await scan(prisma, mode, take, values.after, rules);
    }
  } finally {
    await prisma.$disconnect();
  }
}

config({ quiet: true });
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Catalog quality operation failed.'}\n`,
  );
  process.exitCode = 1;
});
