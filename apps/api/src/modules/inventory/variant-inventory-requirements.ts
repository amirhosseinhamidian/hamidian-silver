import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ProductStatus, VariantInventoryMode } from '../../generated/prisma/enums';

export type VariantQuantity = Readonly<{ variantId: string; quantity: number }>;

type ResolveInventoryRequirementsOptions = Readonly<{
  requirePurchasableComponents?: boolean;
}>;

function addRequirement(requirements: Map<string, number>, variantId: string, quantity: number) {
  const next = (requirements.get(variantId) ?? 0) + quantity;
  if (!Number.isSafeInteger(next) || next <= 0) {
    throw new ConflictException('Composite product inventory quantity is invalid.');
  }
  requirements.set(variantId, next);
}

export async function resolveVariantInventoryRequirements(
  transaction: Prisma.TransactionClient,
  items: readonly VariantQuantity[],
  options: ResolveInventoryRequirementsOptions = {},
): Promise<Map<string, number>> {
  const requested = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new ConflictException('Product quantity is invalid.');
    }
    addRequirement(requested, item.variantId, item.quantity);
  }

  // Lightweight transaction adapters can omit catalog delegates for direct inventory operations.
  if (!transaction.productVariant?.findMany) return requested;

  const variants = await transaction.productVariant.findMany({
    where: { id: { in: [...requested.keys()] } },
    select: {
      id: true,
      inventoryMode: true,
      isActive: true,
      deletedAt: true,
      product: { select: { status: true, deletedAt: true } },
      bundleComponents: {
        select: {
          quantity: true,
          componentVariant: {
            select: {
              id: true,
              inventoryMode: true,
              isActive: true,
              deletedAt: true,
              product: { select: { status: true, deletedAt: true } },
            },
          },
        },
      },
    },
  });

  if (variants.length !== requested.size) {
    throw new ConflictException('One or more product variants no longer exist.');
  }

  const requirements = new Map<string, number>();
  for (const variant of variants) {
    const requestedQuantity = requested.get(variant.id);
    if (!requestedQuantity) continue;

    if (variant.inventoryMode !== VariantInventoryMode.COMPONENTS) {
      addRequirement(requirements, variant.id, requestedQuantity);
      continue;
    }

    if ((variant.bundleComponents ?? []).length === 0) {
      throw new ConflictException('Composite product option has no inventory components.');
    }

    for (const component of variant.bundleComponents ?? []) {
      const target = component.componentVariant;
      if (target.inventoryMode !== VariantInventoryMode.OWN) {
        throw new ConflictException('Nested composite product options are not supported.');
      }
      if (
        options.requirePurchasableComponents &&
        (!target.isActive ||
          target.deletedAt ||
          target.product.status !== ProductStatus.ACTIVE ||
          target.product.deletedAt)
      ) {
        throw new ConflictException('A composite product component is not available for sale.');
      }
      addRequirement(requirements, target.id, requestedQuantity * component.quantity);
    }
  }

  return requirements;
}
