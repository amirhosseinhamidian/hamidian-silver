import { BadRequestException } from '@nestjs/common';
import {
  CatalogAttributeKind as Kind,
  CatalogAttributeSource as Source,
  CatalogAttributeUnit as Unit,
} from '../../generated/prisma/enums';
import type {
  CatalogAttributeConfigDto,
  CatalogAttributeValueDto,
} from './dto/catalog-attribute.dto';

type ValueConfig = Pick<CatalogAttributeConfigDto, 'kind' | 'unit' | 'options'>;
type AttributeCategory = { id: string; parentId: string | null };

export function normalizeLegacyAttributeValue(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fa-IR')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s\u200c]+/g, ' ')
    .trim();
}

export function validateCatalogAttributeValue(
  { kind, unit, options }: ValueConfig,
  value: CatalogAttributeValueDto | null | undefined,
): CatalogAttributeValueDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('The attribute value or unit does not match its definition.');
  }
  const configured = new Set(options.map(({ code }) => code));
  const supplied = Object.keys(value).filter(
    (key) => value[key as keyof CatalogAttributeValueDto] !== undefined,
  );
  const exact = (...keys: string[]) =>
    supplied.length === keys.length && keys.every((key) => supplied.includes(key));
  const validNumber = (number: unknown): number is number => {
    if (
      typeof number !== 'number' ||
      !Number.isFinite(number) ||
      Math.abs(number) > 1_000_000 ||
      Math.abs(number * 1000 - Math.round(number * 1000)) > 0.000001
    )
      return false;
    if (unit === Unit.PER_MILLE) return Number.isInteger(number) && number > 0 && number <= 1000;
    if (unit === Unit.MILLIMETER) return number > 0 && number <= 100000;
    return unit === Unit.NONE || number >= 0;
  };

  if (
    kind === Kind.SELECT &&
    exact('optionCode') &&
    value.optionCode &&
    configured.has(value.optionCode)
  ) {
    return { optionCode: value.optionCode };
  }
  if (
    kind === Kind.MULTI_SELECT &&
    exact('optionCodes') &&
    value.optionCodes?.length &&
    new Set(value.optionCodes).size === value.optionCodes.length &&
    value.optionCodes.every((option) => configured.has(option))
  ) {
    return { optionCodes: [...value.optionCodes].sort() };
  }
  if (kind === Kind.BOOLEAN && exact('boolean') && typeof value.boolean === 'boolean') {
    return { boolean: value.boolean };
  }
  if (value.unit === unit) {
    if (kind === Kind.NUMBER && exact('number', 'unit') && validNumber(value.number)) {
      return { number: value.number, unit };
    }
    if (
      kind === Kind.RANGE &&
      exact('min', 'max', 'unit') &&
      validNumber(value.min) &&
      validNumber(value.max) &&
      value.min <= value.max
    ) {
      return { min: value.min, max: value.max, unit };
    }
  }
  throw new BadRequestException('The attribute value or unit does not match its definition.');
}

export function normalizeCatalogAttributeConfig(input: CatalogAttributeConfigDto) {
  const label = input.label.trim();
  const categoryIds = [...new Set(input.categoryIds.map((id) => id.toLowerCase()))].sort();
  const excludedCategoryIds = [
    ...new Set(input.excludedCategoryIds.map((id) => id.toLowerCase())),
  ].sort();
  if (!label || excludedCategoryIds.some((id) => categoryIds.includes(id))) {
    throw new BadRequestException('The attribute label and category scopes must be valid.');
  }

  const numeric = input.kind === Kind.NUMBER || input.kind === Kind.RANGE;
  const optionKind = input.kind === Kind.SELECT || input.kind === Kind.MULTI_SELECT;
  const manual = input.source === Source.MANUAL;
  const validSource = manual
    ? input.unit !== Unit.SIZE && (numeric || input.unit === Unit.NONE)
    : (input.source === Source.VARIANT_SIZE &&
        input.kind === Kind.SELECT &&
        input.unit === Unit.SIZE) ||
      (input.source === Source.VARIANT_LENGTH &&
        input.kind === Kind.NUMBER &&
        input.unit === Unit.MILLIMETER) ||
      (input.source === Source.VARIANT_WEIGHT &&
        input.kind === Kind.NUMBER &&
        input.unit === Unit.GRAM);
  if (
    !validSource ||
    (manual && optionKind ? input.options.length === 0 : input.options.length !== 0) ||
    (!manual && input.legacyMappings.length > 0)
  ) {
    throw new BadRequestException('The attribute source, unit or options are incompatible.');
  }

  const options = input.options.map(({ code, label: optionLabel }) => ({
    code,
    label: optionLabel.trim(),
  }));
  if (
    options.some((option) => !option.label) ||
    new Set(options.map(({ code }) => code)).size !== options.length
  ) {
    throw new BadRequestException('Attribute option codes must be unique and have a label.');
  }
  const mappings = input.legacyMappings.map(({ legacyValue, value }) => ({
    legacyValue: legacyValue.trim(),
    value: validateCatalogAttributeValue({ ...input, options }, value),
  }));
  const aliases = mappings.map(({ legacyValue }) => normalizeLegacyAttributeValue(legacyValue));
  if (aliases.some((alias) => !alias) || new Set(aliases).size !== aliases.length) {
    throw new BadRequestException(
      'Legacy attribute mappings must be unique and have a valid target.',
    );
  }
  return {
    label,
    kind: input.kind,
    unit: input.unit,
    source: input.source,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    categoryIds,
    excludedCategoryIds,
    options,
    legacyMappings: mappings,
  };
}

export function attributeAppliesToCategories(
  definition: Pick<CatalogAttributeConfigDto, 'categoryIds' | 'excludedCategoryIds' | 'isActive'>,
  memberships: readonly string[],
  categories: ReadonlyMap<string, AttributeCategory>,
): boolean {
  if (!definition.isActive) return false;
  const allowed = new Set(definition.categoryIds);
  const excluded = new Set(definition.excludedCategoryIds);
  return memberships.some((categoryId) => {
    const visited = new Set<string>();
    let current = categories.get(categoryId);
    while (current && !visited.has(current.id)) {
      if (excluded.has(current.id)) return false;
      if (allowed.has(current.id)) return true;
      visited.add(current.id);
      current = current.parentId ? categories.get(current.parentId) : undefined;
    }
    return false;
  });
}
