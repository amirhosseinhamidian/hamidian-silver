import { ConflictException } from '@nestjs/common';
import { VariantInventoryMode } from '../../generated/prisma/enums';
import { resolveVariantInventoryRequirements } from './variant-inventory-requirements';

describe('resolveVariantInventoryRequirements', () => {
  it('expands composite options and aggregates shared physical components', async () => {
    const transaction = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'bracelet',
            inventoryMode: VariantInventoryMode.OWN,
            isActive: true,
            deletedAt: null,
            product: { status: 'ACTIVE', deletedAt: null },
            bundleComponents: [],
          },
          {
            id: 'half-set',
            inventoryMode: VariantInventoryMode.COMPONENTS,
            isActive: true,
            deletedAt: null,
            product: { status: 'ACTIVE', deletedAt: null },
            bundleComponents: [
              {
                quantity: 1,
                componentVariant: {
                  id: 'bracelet',
                  inventoryMode: VariantInventoryMode.OWN,
                  isActive: true,
                  deletedAt: null,
                  product: { status: 'ACTIVE', deletedAt: null },
                },
              },
              {
                quantity: 2,
                componentVariant: {
                  id: 'necklace',
                  inventoryMode: VariantInventoryMode.OWN,
                  isActive: true,
                  deletedAt: null,
                  product: { status: 'ACTIVE', deletedAt: null },
                },
              },
            ],
          },
        ]),
      },
    };

    const result = await resolveVariantInventoryRequirements(transaction as never, [
      { variantId: 'bracelet', quantity: 1 },
      { variantId: 'half-set', quantity: 3 },
    ]);

    expect(Object.fromEntries(result)).toEqual({ bracelet: 4, necklace: 6 });
  });

  it('rejects nested composite components', async () => {
    const transaction = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'bundle',
            inventoryMode: VariantInventoryMode.COMPONENTS,
            isActive: true,
            deletedAt: null,
            product: { status: 'ACTIVE', deletedAt: null },
            bundleComponents: [
              {
                quantity: 1,
                componentVariant: {
                  id: 'nested',
                  inventoryMode: VariantInventoryMode.COMPONENTS,
                  isActive: true,
                  deletedAt: null,
                  product: { status: 'ACTIVE', deletedAt: null },
                },
              },
            ],
          },
        ]),
      },
    };

    await expect(
      resolveVariantInventoryRequirements(transaction as never, [
        { variantId: 'bundle', quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
