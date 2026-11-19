import {
  CatalogAttributeKind as Kind,
  CatalogAttributeSource as Source,
  CatalogAttributeUnit as Unit,
} from '../../generated/prisma/enums';
import {
  attributeAppliesToCategories,
  normalizeCatalogAttributeConfig,
  normalizeLegacyAttributeValue,
  validateCatalogAttributeValue,
} from './catalog-attribute-values';
import { SetCatalogProductAttributeDto } from './dto/catalog-attribute.dto';

describe('typed catalog attribute rules', () => {
  it('rejects strings used as numbers or booleans at the HTTP boundary', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    const metadata = { type: 'body', metatype: SetCatalogProductAttributeDto } as const;
    const revision = { definitionVersion: 1, expectedRevision: 0 };
    for (const value of [{ boolean: 'false' }, { number: '925', unit: Unit.PER_MILLE }]) {
      await expect(pipe.transform({ ...revision, value }, metadata)).rejects.toThrow();
    }
    await expect(
      pipe.transform({ ...revision, value: { boolean: false } }, metadata),
    ).resolves.toMatchObject({
      value: { boolean: false },
    });
  });

  it('accepts only the configured unit, bounds and shape', () => {
    const fineness = { kind: Kind.NUMBER, unit: Unit.PER_MILLE, options: [] };
    expect(validateCatalogAttributeValue(fineness, { number: 925, unit: Unit.PER_MILLE })).toEqual({
      number: 925,
      unit: Unit.PER_MILLE,
    });
    expect(() =>
      validateCatalogAttributeValue(fineness, { number: 925, unit: Unit.GRAM }),
    ).toThrow();
    expect(() =>
      validateCatalogAttributeValue(fineness, { number: 1001, unit: Unit.PER_MILLE }),
    ).toThrow();
    const length = { kind: Kind.RANGE, unit: Unit.MILLIMETER, options: [] };
    expect(() =>
      validateCatalogAttributeValue(length, { min: 240, max: 200, unit: Unit.MILLIMETER }),
    ).toThrow();
    expect(
      validateCatalogAttributeValue(
        { kind: Kind.BOOLEAN, unit: Unit.NONE, options: [] },
        { boolean: false },
      ),
    ).toEqual({ boolean: false });
  });

  it('validates unique option codes and legacy mappings against the same contract', () => {
    const config = {
      label: 'بند',
      kind: Kind.MULTI_SELECT,
      unit: Unit.NONE,
      source: Source.MANUAL,
      isActive: true,
      sortOrder: 1,
      categoryIds: [],
      excludedCategoryIds: [],
      options: [
        { code: 'steel', label: 'استیل' },
        { code: 'leather', label: 'چرم' },
      ],
      legacyMappings: [
        { legacyValue: ' چرم و استيل ', value: { optionCodes: ['steel', 'leather'] } },
      ],
    };
    expect(normalizeCatalogAttributeConfig(config).legacyMappings[0]).toEqual({
      legacyValue: 'چرم و استيل',
      value: { optionCodes: ['leather', 'steel'] },
    });
    expect(normalizeLegacyAttributeValue('چرم و استيل')).toBe(
      normalizeLegacyAttributeValue('چرم و استیل'),
    );
    expect(() =>
      normalizeCatalogAttributeConfig({
        ...config,
        legacyMappings: [{ legacyValue: 'فلز', value: { optionCodes: ['metal'] } }],
      }),
    ).toThrow();
    expect(() =>
      normalizeCatalogAttributeConfig({ ...config, source: Source.VARIANT_SIZE }),
    ).toThrow();
  });

  it('inherits activation, respects excluded branches and permits explicit descendants', () => {
    const categories = new Map([
      ['root', { id: 'root', parentId: null }],
      ['excluded', { id: 'excluded', parentId: 'root' }],
      ['allowed-again', { id: 'allowed-again', parentId: 'excluded' }],
      ['sibling', { id: 'sibling', parentId: 'root' }],
    ]);
    const definition = {
      isActive: true,
      categoryIds: ['root', 'allowed-again'],
      excludedCategoryIds: ['excluded'],
    };
    expect(attributeAppliesToCategories(definition, ['excluded'], categories)).toBe(false);
    expect(attributeAppliesToCategories(definition, ['allowed-again'], categories)).toBe(true);
    expect(attributeAppliesToCategories(definition, ['sibling'], categories)).toBe(true);
    expect(
      attributeAppliesToCategories({ ...definition, isActive: false }, ['sibling'], categories),
    ).toBe(false);
  });
});
import { ValidationPipe } from '@nestjs/common';
