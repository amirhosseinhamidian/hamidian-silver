import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CatalogAttributeSource } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  attributeAppliesToCategories,
  normalizeCatalogAttributeConfig,
  normalizeLegacyAttributeValue,
  validateCatalogAttributeValue,
} from './catalog-attribute-values';
import { catalogHierarchyTransaction } from './catalog-hierarchy-transaction';
import type {
  CatalogAttributeConfigDto,
  CatalogAttributeDefinitionDto,
  CatalogAttributeValueDto,
  CatalogProductAttributeDto,
  CreateCatalogAttributeDto,
  PublicTypedCatalogAttributeDto,
  SetCatalogProductAttributeDto,
  UpdateCatalogAttributeDto,
} from './dto/catalog-attribute.dto';

type AttributeReader = Pick<
  PrismaService,
  'catalogAttributeDefinition' | 'catalogProductAttributeValue' | 'category' | 'product'
>;
type VersionRow = Prisma.CatalogAttributeVersionGetPayload<object>;
const latestDefinition = { versions: { orderBy: { version: 'desc' }, take: 1 } } as const;

function projectVersion(row: VersionRow): CatalogAttributeDefinitionDto {
  return {
    code: row.attributeCode,
    version: row.version,
    label: row.label,
    kind: row.kind,
    unit: row.unit,
    source: row.source,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    categoryIds: row.categoryIds,
    excludedCategoryIds: row.excludedCategoryIds,
    options: row.options as unknown as CatalogAttributeDefinitionDto['options'],
    legacyMappings:
      row.legacyMappings as unknown as CatalogAttributeDefinitionDto['legacyMappings'],
  };
}

async function currentVersions(reader: Pick<AttributeReader, 'catalogAttributeDefinition'>) {
  const definitions = await reader.catalogAttributeDefinition.findMany({
    include: latestDefinition,
  });
  return definitions
    .flatMap((definition) =>
      definition.versions[0] ? [projectVersion(definition.versions[0])] : [],
    )
    .sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

function versionPayload(config: CatalogAttributeConfigDto) {
  const normalized = normalizeCatalogAttributeConfig(config);
  return {
    ...normalized,
    legacyMappings: normalized.legacyMappings.map(({ legacyValue, value }) => ({
      legacyValue,
      value: { ...value },
    })),
  };
}

export async function remapCatalogAttributeCategoryScopes(
  transaction: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
) {
  const source = sourceId.toLowerCase();
  const target = targetId.toLowerCase();
  for (const definition of await currentVersions(transaction)) {
    const allowedAtSource = definition.categoryIds.includes(source);
    const excludedAtSource = definition.excludedCategoryIds.includes(source);
    if (!allowedAtSource && !excludedAtSource) continue;

    const categoryIds = definition.categoryIds.filter((id) => id !== source);
    const excludedCategoryIds = definition.excludedCategoryIds.filter((id) => id !== source);
    if (!categoryIds.includes(target) && !excludedCategoryIds.includes(target)) {
      (allowedAtSource ? categoryIds : excludedCategoryIds).push(target);
    }
    await appendDefinitionVersion(transaction, definition, {
      ...definition,
      categoryIds,
      excludedCategoryIds,
    });
  }
}

async function appendDefinitionVersion(
  transaction: Prisma.TransactionClient,
  current: CatalogAttributeDefinitionDto,
  config: CatalogAttributeConfigDto,
) {
  const version = current.version + 1;
  const claimed = await transaction.catalogAttributeDefinition.updateMany({
    where: { code: current.code, currentVersion: current.version },
    data: { currentVersion: version },
  });
  if (claimed.count !== 1) {
    throw new ConflictException('The attribute definition has changed. Reload it before saving.');
  }
  const row = await transaction.catalogAttributeVersion.create({
    data: { attributeCode: current.code, version, ...versionPayload(config) },
  });
  return projectVersion(row);
}

@Injectable()
export class CatalogAttributesService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions() {
    return currentVersions(this.prisma);
  }

  async createDefinition(dto: CreateCatalogAttributeDto): Promise<CatalogAttributeDefinitionDto> {
    try {
      return await catalogHierarchyTransaction(this.prisma, async (transaction) => {
        await this.validateCategories(transaction, dto);
        await transaction.catalogAttributeDefinition.create({ data: { code: dto.code } });
        const row = await transaction.catalogAttributeVersion.create({
          data: { attributeCode: dto.code, version: 1, ...versionPayload(dto) },
        });
        return projectVersion(row);
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An attribute with this code already exists.');
      }
      throw error;
    }
  }

  updateDefinition(code: string, dto: UpdateCatalogAttributeDto) {
    return catalogHierarchyTransaction(this.prisma, async (transaction) => {
      const current = await this.requireDefinition(transaction, code);
      if (current.version !== dto.expectedVersion) {
        throw new ConflictException(
          'The attribute definition has changed. Reload it before saving.',
        );
      }
      await this.validateCategories(transaction, dto);
      return appendDefinitionVersion(transaction, current, dto);
    });
  }

  async listProductValues(productId: string): Promise<CatalogProductAttributeDto[]> {
    const [context, definitions, stored] = await Promise.all([
      this.loadCategoryContext(this.prisma, productId),
      this.listDefinitions(),
      this.latestValues(productId),
    ]);
    return definitions
      .filter((definition) =>
        attributeAppliesToCategories(definition, context.memberships, context.categories),
      )
      .map((definition) => this.productProjection(definition, stored.get(definition.code)));
  }

  async listPublicValues(productId: string): Promise<PublicTypedCatalogAttributeDto[]> {
    const stored = await this.latestValues(productId);
    if (![...stored.values()].some(({ value }) => value !== null)) return [];
    const [context, definitions] = await Promise.all([
      this.loadCategoryContext(this.prisma, productId),
      this.listDefinitions(),
    ]);
    const values = definitions
      .filter((definition) =>
        attributeAppliesToCategories(definition, context.memberships, context.categories),
      )
      .map((definition) => this.productProjection(definition, stored.get(definition.code)));
    return values.flatMap(({ definition, value, definitionVersion }) => {
      if (
        value === null ||
        definitionVersion === null ||
        definition.source !== CatalogAttributeSource.MANUAL
      )
        return [];
      try {
        return [
          {
            code: definition.code,
            label: definition.label,
            kind: definition.kind,
            unit: definition.unit,
            options: definition.options,
            definitionVersion,
            value: validateCatalogAttributeValue(definition, value),
          },
        ];
      } catch (error) {
        if (error instanceof BadRequestException) return [];
        throw error;
      }
    });
  }

  setProductValue(productId: string, code: string, dto: SetCatalogProductAttributeDto) {
    return catalogHierarchyTransaction(this.prisma, async (transaction) => {
      const [definition, context, existing] = await Promise.all([
        this.requireDefinition(transaction, code),
        this.loadCategoryContext(transaction, productId),
        transaction.catalogProductAttributeValue.findFirst({
          where: { productId, attributeCode: code },
          orderBy: { revision: 'desc' },
        }),
      ]);
      if (
        definition.version !== dto.definitionVersion ||
        (existing?.revision ?? 0) !== dto.expectedRevision
      ) {
        throw new ConflictException(
          'The attribute definition or value has changed. Reload before saving.',
        );
      }
      const clear = dto.clear === true;
      const legacyValue = dto.legacyValue?.trim() || null;
      const requested = [clear, Boolean(legacyValue), Boolean(dto.value)].filter(Boolean);
      if (requested.length !== 1 || (dto.legacyValue != null && !legacyValue)) {
        throw new BadRequestException(
          'Provide one typed value, one mapped legacy value, or clear the value.',
        );
      }
      if (
        !clear &&
        (definition.source !== CatalogAttributeSource.MANUAL ||
          !attributeAppliesToCategories(definition, context.memberships, context.categories))
      ) {
        throw new BadRequestException('This product cannot set a manual value for this attribute.');
      }
      const mapped = legacyValue
        ? definition.legacyMappings.find(
            (entry) =>
              normalizeLegacyAttributeValue(entry.legacyValue) ===
              normalizeLegacyAttributeValue(legacyValue),
          )?.value
        : dto.value;
      if (!clear && !mapped)
        throw new BadRequestException('This legacy value has no approved mapping.');
      const value =
        clear || !mapped ? Prisma.DbNull : { ...validateCatalogAttributeValue(definition, mapped) };
      const saved = await transaction.catalogProductAttributeValue
        .create({
          data: {
            productId,
            attributeCode: code,
            revision: (existing?.revision ?? 0) + 1,
            definitionVersion: definition.version,
            value,
            legacyValue,
          },
        })
        .catch((error: unknown) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
          ) {
            throw new ConflictException('The attribute value has changed. Reload before saving.');
          }
          throw error;
        });
      return this.productProjection(definition, saved);
    });
  }

  private async requireDefinition(
    reader: Pick<AttributeReader, 'catalogAttributeDefinition'>,
    code: string,
  ) {
    const definition = await reader.catalogAttributeDefinition.findUnique({
      where: { code },
      include: latestDefinition,
    });
    if (!definition?.versions[0])
      throw new NotFoundException('Catalog attribute definition was not found.');
    return projectVersion(definition.versions[0]);
  }

  private async validateCategories(
    reader: Pick<AttributeReader, 'category'>,
    config: Pick<CatalogAttributeConfigDto, 'categoryIds' | 'excludedCategoryIds'>,
  ) {
    const ids = [
      ...new Set(
        [...config.categoryIds, ...config.excludedCategoryIds].map((id) => id.toLowerCase()),
      ),
    ];
    if (ids.length === 0) return;
    const count = await reader.category.count({ where: { id: { in: ids }, deletedAt: null } });
    if (count !== ids.length)
      throw new BadRequestException('One or more attribute categories were not found.');
  }

  private async loadCategoryContext(
    reader: Pick<AttributeReader, 'category' | 'product'>,
    productId: string,
  ) {
    const [product, categories] = await Promise.all([
      reader.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { categories: { select: { categoryId: true } } },
      }),
      reader.category.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, parentId: true },
      }),
    ]);
    if (!product) throw new NotFoundException('Product was not found.');
    return {
      memberships: product.categories.map(({ categoryId }) => categoryId),
      categories: new Map(categories.map((category) => [category.id, category] as const)),
    };
  }

  private async latestValues(productId: string) {
    const rows = await this.prisma.catalogProductAttributeValue.findMany({
      where: { productId },
      orderBy: [{ attributeCode: 'asc' }, { revision: 'desc' }],
      distinct: ['attributeCode'],
    });
    return new Map(rows.map((row) => [row.attributeCode, row] as const));
  }

  private productProjection(
    definition: CatalogAttributeDefinitionDto,
    stored?: Prisma.CatalogProductAttributeValueGetPayload<object>,
  ): CatalogProductAttributeDto {
    return {
      definition,
      value: (stored?.value as unknown as CatalogAttributeValueDto | null | undefined) ?? null,
      definitionVersion: stored?.definitionVersion ?? null,
      revision: stored?.revision ?? 0,
      legacyValue: stored?.legacyValue ?? null,
    };
  }
}
