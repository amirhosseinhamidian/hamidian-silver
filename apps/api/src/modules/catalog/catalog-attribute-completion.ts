import { BadRequestException } from '@nestjs/common';
import { CatalogAttributeSource, SizeMode } from '../../generated/prisma/enums';
import { validateCatalogAttributeValue } from './catalog-attribute-values';
import type {
  CatalogAttributeDefinitionDto,
  CatalogAttributeValueDto,
} from './dto/catalog-attribute.dto';

export const completionVariantSelect = {
  lengthMm: true,
  weightGrams: true,
  size: {
    select: {
      isActive: true,
      deletedAt: true,
      group: { select: { isActive: true, deletedAt: true } },
    },
  },
} as const;

export type CompletionItem = {
  sizeMode: SizeMode;
  variants: readonly {
    size: {
      isActive: boolean;
      deletedAt: Date | null;
      group: { isActive: boolean; deletedAt: Date | null };
    } | null;
    lengthMm: number | null;
    weightGrams: { toString(): string } | null;
  }[];
};

export function readAttributeCompletion(
  definition: CatalogAttributeDefinitionDto,
  product: CompletionItem,
  stored?: CatalogAttributeValueDto | null,
): 'complete' | 'missing' | 'not-applicable' {
  if (definition.source === CatalogAttributeSource.MANUAL) {
    if (!stored) return 'missing';
    try {
      validateCatalogAttributeValue(definition, stored);
      return 'complete';
    } catch (error) {
      if (error instanceof BadRequestException) return 'missing';
      throw error;
    }
  }
  if (
    definition.source === CatalogAttributeSource.VARIANT_SIZE &&
    product.sizeMode !== SizeMode.SIZED
  ) {
    return 'not-applicable';
  }
  if (product.variants.length === 0) return 'missing';
  const complete = product.variants.every(({ size, weightGrams, lengthMm }) => {
    switch (definition.source) {
      case CatalogAttributeSource.VARIANT_SIZE:
        return Boolean(
          size?.isActive && !size.deletedAt && size.group.isActive && !size.group.deletedAt,
        );
      case CatalogAttributeSource.VARIANT_LENGTH:
        return lengthMm !== null && lengthMm > 0;
      case CatalogAttributeSource.VARIANT_WEIGHT:
        return weightGrams !== null && Number(weightGrams.toString()) > 0;
    }
  });
  return complete ? 'complete' : 'missing';
}
