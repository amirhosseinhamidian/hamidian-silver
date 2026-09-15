import { describe, expect, it } from 'vitest';

import { parseInventoryCatalog, parseWarehouses } from '@/lib/inventory/inventory-model';

describe('inventory model parsers', () => {
  it('parses warehouses and preserves operational flags', () => {
    expect(
      parseWarehouses([
        {
          id: 'warehouse-1',
          code: 'MAIN',
          name: 'انبار مرکزی',
          isDefault: true,
          isActive: true,
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'warehouse-1',
        isDefault: true,
        isActive: true,
      }),
    ]);
  });

  it('parses uninitialized inventory rows with zero quantities', () => {
    expect(
      parseInventoryCatalog([
        {
          inventoryId: null,
          warehouse: { id: 'warehouse-1' },
          product: {
            id: 'product-1',
            name: 'انگشتر آذر',
            slug: 'azar-ring',
            status: 'ACTIVE',
          },
          variant: {
            id: 'variant-1',
            sku: 'RING-52',
            name: null,
            isActive: true,
            size: { label: '۵۲' },
          },
          onHand: 0,
          reserved: 0,
          available: 0,
          lowStockThreshold: 0,
          isLowStock: true,
          updatedAt: null,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        inventoryId: null,
        sizeLabel: '۵۲',
        available: 0,
        isLowStock: true,
      }),
    ]);
  });

  it('rejects incomplete catalog payloads', () => {
    expect(parseInventoryCatalog([{ inventoryId: null }])).toBeNull();
  });
});
