import { calculatePlatingPriceToman } from '../../common/plating-price';
import { ProductStatus, SizeMode, VariantInventoryMode } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import type { RecoveredCartItemDto } from './dto/cart-recovery.dto';
import type { CreateOrderItemDto } from './dto/create-order.dto';

export async function loadRecoveryItems(
  tx: Prisma.TransactionClient,
  selections: readonly CreateOrderItemDto[],
) {
  const variants = await tx.productVariant.findMany({
    where: {
      id: { in: selections.map(({ variantId }) => variantId) },
      isActive: true,
      deletedAt: null,
      product: { status: ProductStatus.ACTIVE, deletedAt: null },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      salePriceToman: true,
      platingEligible: true,
      weightGrams: true,
      inventoryMode: true,
      size: {
        select: {
          label: true,
          isActive: true,
          deletedAt: true,
          group: { select: { isActive: true, deletedAt: true } },
        },
      },
      product: { select: { name: true, slug: true, salePriceToman: true, sizeMode: true } },
      platingOptions: {
        where: { isActive: true, platingRate: { isActive: true } },
        select: {
          platingRate: { select: { type: true, pricePerGramToman: true, leadTimeDays: true } },
        },
      },
      bundleComponents: {
        select: {
          quantity: true,
          componentVariant: {
            select: {
              id: true,
              isActive: true,
              deletedAt: true,
              inventoryMode: true,
              product: { select: { status: true, deletedAt: true } },
            },
          },
        },
      },
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const warehouse = await tx.warehouse.findFirst({
    where: { isDefault: true, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const stock =
    warehouse && variants.length
      ? await tx.inventory.findMany({
          where: {
            warehouseId: warehouse.id,
            variantId: {
              in: variants.flatMap(({ id, bundleComponents }) => [
                id,
                ...bundleComponents.map(({ componentVariant }) => componentVariant.id),
              ]),
            },
          },
          select: { variantId: true, onHand: true, reserved: true },
        })
      : [];
  const remaining = new Map(
    stock.map(({ variantId, onHand, reserved }) => [variantId, Math.max(0, onHand - reserved)]),
  );

  return selections.map((selection): RecoveredCartItemDto | null => {
    const variant = byId.get(selection.variantId);
    if (!variant) return null;
    const { product, size } = variant;
    if (
      product.sizeMode === SizeMode.SIZED &&
      (!size?.isActive || size.deletedAt || !size.group.isActive || size.group.deletedAt)
    )
      return null;
    const unitSalePriceToman = variant.salePriceToman ?? product.salePriceToman;
    if (unitSalePriceToman === null) return null;
    const platingType = selection.platingType ?? null;
    const rate = variant.platingOptions.find(
      ({ platingRate }) => platingRate.type === platingType,
    )?.platingRate;
    if (platingType && (!rate || !variant.platingEligible || !variant.weightGrams)) return null;

    const requirements =
      variant.inventoryMode === VariantInventoryMode.COMPONENTS
        ? variant.bundleComponents.map(({ quantity, componentVariant }) => ({
            variantId: componentVariant.id,
            quantity:
              componentVariant.isActive &&
              !componentVariant.deletedAt &&
              componentVariant.inventoryMode === VariantInventoryMode.OWN &&
              componentVariant.product.status === ProductStatus.ACTIVE &&
              !componentVariant.product.deletedAt
                ? quantity
                : 0,
          }))
        : [{ variantId: variant.id, quantity: 1 }];
    const maxQuantity = requirements.length
      ? Math.min(
          99,
          ...requirements.map(({ variantId, quantity }) =>
            quantity > 0 ? Math.floor((remaining.get(variantId) ?? 0) / quantity) : 0,
          ),
        )
      : 0;
    const quantity = Math.min(selection.quantity, maxQuantity);
    if (quantity > 0) {
      for (const requirement of requirements) {
        remaining.set(
          requirement.variantId,
          (remaining.get(requirement.variantId) ?? 0) - requirement.quantity * quantity,
        );
      }
    }
    return {
      variantId: variant.id,
      variantLabel: variant.name ?? size?.label ?? variant.sku,
      productSlug: product.slug,
      productName: product.name,
      platingType,
      unitSalePriceToman,
      unitPlatingPriceToman:
        rate && variant.weightGrams
          ? calculatePlatingPriceToman(variant.weightGrams.toString(), rate.pricePerGramToman)
          : 0,
      platingLeadTimeDays: rate?.leadTimeDays ?? 0,
      quantity,
      maxQuantity,
    };
  });
}
