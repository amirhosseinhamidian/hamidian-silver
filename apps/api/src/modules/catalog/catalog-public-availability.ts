import {
  ProductPurchaseMode,
  ProductStatus,
  SizeMode,
  VariantInventoryMode,
} from '../../generated/prisma/enums';

export const publicCatalogProductWhere = { status: ProductStatus.ACTIVE, deletedAt: null } as const;

const inventorySelect = {
  onHand: true,
  reserved: true,
  warehouse: { select: { isActive: true, deletedAt: true } },
} as const;

export const availabilitySelect = {
  inventoryMode: true,
  inventories: { select: inventorySelect },
  size: {
    select: {
      isActive: true,
      deletedAt: true,
      group: { select: { isActive: true, deletedAt: true } },
    },
  },
  bundleComponents: {
    select: {
      quantity: true,
      componentVariant: {
        select: {
          inventoryMode: true,
          isActive: true,
          deletedAt: true,
          inventories: { select: inventorySelect },
        },
      },
    },
  },
} as const;

type Inventory = {
  onHand: number;
  reserved: number;
  warehouse: { isActive: boolean; deletedAt: Date | null };
};
type InventoryVariant = { inventoryMode: VariantInventoryMode; inventories: readonly Inventory[] };
type AvailableVariant = InventoryVariant & {
  size: {
    isActive: boolean;
    deletedAt: Date | null;
    group: { isActive: boolean; deletedAt: Date | null };
  } | null;
  bundleComponents: readonly {
    quantity: number;
    componentVariant: InventoryVariant & { isActive: boolean; deletedAt: Date | null };
  }[];
};

function ownStock(inventories: readonly Inventory[]) {
  return inventories.reduce(
    (total, { onHand, reserved, warehouse }) =>
      warehouse.isActive && !warehouse.deletedAt ? total + Math.max(0, onHand - reserved) : total,
    0,
  );
}

export function variantAvailableQuantity(variant: AvailableVariant, sizeMode: SizeMode) {
  const { size, inventories, inventoryMode, bundleComponents } = variant;
  if (
    sizeMode === SizeMode.SIZED &&
    (!size?.isActive || size.deletedAt || !size.group.isActive || size.group.deletedAt)
  )
    return 0;
  if (inventoryMode !== VariantInventoryMode.COMPONENTS) return ownStock(inventories);
  if (!bundleComponents.length) return 0;
  return Math.min(
    ...bundleComponents.map(({ quantity, componentVariant }) =>
      quantity > 0 &&
      componentVariant.isActive &&
      !componentVariant.deletedAt &&
      componentVariant.inventoryMode === VariantInventoryMode.OWN
        ? Math.floor(ownStock(componentVariant.inventories) / quantity)
        : 0,
    ),
  );
}

export function productAvailableQuantity(
  purchaseMode: ProductPurchaseMode,
  quantities: readonly number[],
) {
  return quantities.reduce(
    (total, quantity) =>
      purchaseMode === ProductPurchaseMode.COMPOSITE ? Math.max(total, quantity) : total + quantity,
    0,
  );
}
