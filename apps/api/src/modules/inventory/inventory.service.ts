import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { isNonNegativeInt32, isSignedInt32 } from '../../common/int32';
import { InventoryMovementType } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { BulkSetStockDto } from './dto/bulk-set-stock.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { InventoryCatalogQueryDto } from './dto/inventory-catalog-query.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { SetLowStockThresholdDto } from './dto/set-low-stock-threshold.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

type InventorySnapshot = {
  id: string;
  warehouseId: string;
  variantId: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createWarehouse(dto: CreateWarehouseDto) {
    const code = dto.code.trim();
    const name = dto.name.trim();

    if (!code || !name) {
      throw new DomainException(
        ErrorCode.INVENTORY_STATE_CHANGED,
        'Warehouse code and name are required.',
      );
    }

    if (dto.isDefault && dto.isActive === false) {
      throw new DomainException(
        ErrorCode.INVENTORY_STATE_CHANGED,
        'The default warehouse must be active.',
      );
    }

    try {
      if (!dto.isDefault) {
        return await this.prisma.warehouse.create({
          data: {
            code,
            name,
            isDefault: false,
            isActive: dto.isActive ?? true,
          },
        });
      }

      return await this.prisma.$transaction(async (transaction) => {
        await transaction.warehouse.updateMany({
          where: {
            isDefault: true,
            deletedAt: null,
          },
          data: {
            isDefault: false,
          },
        });

        return transaction.warehouse.create({
          data: {
            code,
            name,
            isDefault: true,
            isActive: dto.isActive ?? true,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new DomainException(
          ErrorCode.INVENTORY_STATE_CHANGED,
          'Another warehouse already uses this code.',
        );
      }
      throw error;
    }
  }

  listWarehouses() {
    return this.prisma.warehouse.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async updateWarehouse(warehouseId: string, dto: UpdateWarehouseDto) {
    const code = dto.code?.trim();
    const name = dto.name?.trim();

    if (code === '' || name === '') {
      throw new DomainException(
        ErrorCode.INVENTORY_STATE_CHANGED,
        'Warehouse code and name are required.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.warehouse.findFirst({
        where: { id: warehouseId, deletedAt: null },
        select: { id: true, isDefault: true, isActive: true },
      });

      if (!current) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Warehouse was not found.');
      }

      const nextDefault = dto.isDefault ?? current.isDefault;
      const nextActive = dto.isActive ?? current.isActive;

      if (current.isDefault && dto.isDefault === false) {
        throw new DomainException(
          ErrorCode.INVENTORY_STATE_CHANGED,
          'Select another default warehouse before removing this default.',
        );
      }

      if (nextDefault && !nextActive) {
        throw new DomainException(
          ErrorCode.INVENTORY_STATE_CHANGED,
          'The default warehouse must be active.',
        );
      }

      if (dto.isDefault === true) {
        await transaction.warehouse.updateMany({
          where: { id: { not: warehouseId }, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      try {
        return await transaction.warehouse.update({
          where: { id: warehouseId },
          data: {
            ...(code !== undefined ? { code } : {}),
            ...(name !== undefined ? { name } : {}),
            ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new DomainException(
            ErrorCode.INVENTORY_STATE_CHANGED,
            'Another warehouse already uses this code.',
          );
        }
        throw error;
      }
    });
  }

  async adjustStock(dto: AdjustStockDto, actorUserId: string) {
    if (!isSignedInt32(dto.onHandDelta) || dto.onHandDelta === 0) {
      throw new DomainException(
        ErrorCode.INVENTORY_NOT_AVAILABLE,
        'Stock adjustment exceeds the supported range.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const warehouse = await transaction.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!warehouse) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Warehouse was not found.');
      }

      const variant = await transaction.productVariant.findFirst({
        where: {
          id: dto.variantId,
          isActive: true,
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
          sku: true,
        },
      });

      if (!variant) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Product variant was not found.');
      }

      const current = await transaction.inventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: dto.warehouseId,
            variantId: dto.variantId,
          },
        },
      });

      if (!current && dto.onHandDelta < 0) {
        throw new DomainException(
          ErrorCode.INVENTORY_NOT_AVAILABLE,
          'Stock cannot be reduced below zero.',
        );
      }

      const nextOnHand = (current?.onHand ?? 0) + dto.onHandDelta;
      const reserved = current?.reserved ?? 0;

      if (!isNonNegativeInt32(nextOnHand)) {
        throw new DomainException(
          ErrorCode.INVENTORY_NOT_AVAILABLE,
          'Stock quantity exceeds the supported range.',
        );
      }

      if (nextOnHand < reserved) {
        throw new DomainException(
          ErrorCode.INVENTORY_RESERVATION_FAILED,
          'On-hand stock cannot be lower than reserved stock.',
        );
      }

      let inventory: InventorySnapshot;

      if (current) {
        const updated = await transaction.inventory.updateMany({
          where: {
            id: current.id,
            onHand: current.onHand,
            reserved: current.reserved,
          },
          data: {
            onHand: nextOnHand,
          },
        });

        if (updated.count !== 1) {
          throw new DomainException(
            ErrorCode.INVENTORY_STATE_CHANGED,
            'Inventory changed while adjusting stock; reload and retry.',
          );
        }

        inventory = await transaction.inventory.findUniqueOrThrow({
          where: {
            id: current.id,
          },
        });
      } else {
        try {
          inventory = await transaction.inventory.create({
            data: {
              warehouseId: dto.warehouseId,
              variantId: dto.variantId,
              onHand: nextOnHand,
            },
          });
        } catch (error) {
          if (this.isUniqueConstraintError(error)) {
            throw new DomainException(
              ErrorCode.INVENTORY_STATE_CHANGED,
              'Inventory was created concurrently; reload and retry the adjustment.',
            );
          }

          throw error;
        }
      }

      await transaction.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          actorUserId,
          type: InventoryMovementType.ADJUSTMENT,
          onHandDelta: dto.onHandDelta,
          reservedDelta: 0,
          onHandAfter: inventory.onHand,
          reservedAfter: inventory.reserved,
          reason: dto.reason,
        },
      });

      const stock = this.toStockView(inventory);
      const direction = dto.onHandDelta > 0 ? 'افزایش' : 'کاهش';
      return attachHumanAuditEvent(stock, {
        title: `موجودی SKU ${variant.sku} به تعداد ${Math.abs(dto.onHandDelta)} ${direction} یافت.`,
        operationType: 'STOCK_ADJUSTMENT',
        entityName: variant.sku,
        changes: [
          {
            field: 'onHand',
            label: 'موجودی فیزیکی',
            before: current?.onHand ?? 0,
            after: inventory.onHand,
          },
        ],
      });
    });
  }

  async bulkSetStock(dto: BulkSetStockDto, actorUserId: string) {
    if (!isNonNegativeInt32(dto.onHand)) {
      throw new DomainException(
        ErrorCode.INVENTORY_NOT_AVAILABLE,
        'Bulk stock quantity exceeds the supported range.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const warehouse = await transaction.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!warehouse) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Warehouse was not found.');
      }

      const variants = await transaction.productVariant.findMany({
        where: {
          id: {
            in: dto.variantIds,
          },
          isActive: true,
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
        },
      });

      if (variants.length !== dto.variantIds.length) {
        throw new DomainException(
          ErrorCode.NOT_FOUND,
          'One or more product variants were not found.',
        );
      }

      for (const variantId of dto.variantIds) {
        const current = await transaction.inventory.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: dto.warehouseId,
              variantId,
            },
          },
        });

        const reserved = current?.reserved ?? 0;

        if (dto.onHand < reserved) {
          throw new DomainException(
            ErrorCode.INVENTORY_RESERVATION_FAILED,
            'Bulk stock quantity cannot be lower than reserved stock.',
          );
        }

        let inventory: InventorySnapshot;

        if (current) {
          const updated = await transaction.inventory.updateMany({
            where: {
              id: current.id,
              onHand: current.onHand,
              reserved: current.reserved,
            },
            data: {
              onHand: dto.onHand,
            },
          });

          if (updated.count !== 1) {
            throw new DomainException(
              ErrorCode.INVENTORY_STATE_CHANGED,
              'Inventory changed while bulk-setting stock; reload and retry.',
            );
          }

          inventory = await transaction.inventory.findUniqueOrThrow({
            where: {
              id: current.id,
            },
          });
        } else {
          try {
            inventory = await transaction.inventory.create({
              data: {
                warehouseId: dto.warehouseId,
                variantId,
                onHand: dto.onHand,
              },
            });
          } catch (error) {
            if (this.isUniqueConstraintError(error)) {
              throw new DomainException(
                ErrorCode.INVENTORY_STATE_CHANGED,
                'Inventory was created concurrently; reload and retry the bulk stock update.',
              );
            }

            throw error;
          }
        }

        const delta = dto.onHand - (current?.onHand ?? 0);

        if (delta !== 0) {
          await transaction.inventoryMovement.create({
            data: {
              inventoryId: inventory.id,
              actorUserId,
              type: InventoryMovementType.ADJUSTMENT,
              onHandDelta: delta,
              reservedDelta: 0,
              onHandAfter: inventory.onHand,
              reservedAfter: inventory.reserved,
              reason: 'Bulk stock set',
            },
          });
        }
      }

      const inventory = await transaction.inventory.findMany({
        where: {
          warehouseId: dto.warehouseId,
          variantId: {
            in: dto.variantIds,
          },
        },
        orderBy: {
          variantId: 'asc',
        },
      });

      return inventory.map((item) => this.toStockView(item));
    });
  }

  async setLowStockThreshold(dto: SetLowStockThresholdDto) {
    if (!isNonNegativeInt32(dto.lowStockThreshold)) {
      throw new DomainException(
        ErrorCode.INVENTORY_NOT_AVAILABLE,
        'Low-stock threshold exceeds the supported range.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const warehouse = await transaction.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!warehouse) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Warehouse was not found.');
      }

      const variant = await transaction.productVariant.findFirst({
        where: {
          id: dto.variantId,
          isActive: true,
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
        },
      });

      if (!variant) {
        throw new DomainException(ErrorCode.NOT_FOUND, 'Product variant was not found.');
      }

      const inventory = await transaction.inventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: dto.warehouseId,
            variantId: dto.variantId,
          },
        },
        update: {
          lowStockThreshold: dto.lowStockThreshold,
        },
        create: {
          warehouseId: dto.warehouseId,
          variantId: dto.variantId,
          lowStockThreshold: dto.lowStockThreshold,
        },
      });

      return this.toStockView(inventory);
    });
  }

  async listStock(query: ListInventoryQueryDto) {
    const inventory = await this.prisma.inventory.findMany({
      where: {
        warehouseId: query.warehouseId,
        warehouse: {
          deletedAt: null,
        },
        variant: {
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
      },
      orderBy: [{ warehouseId: 'asc' }, { variantId: 'asc' }],
      include: {
        warehouse: true,
        variant: {
          include: {
            size: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return inventory.map((item) => ({
      ...item,
      available: item.onHand - item.reserved,
      isLowStock: item.onHand - item.reserved <= item.lowStockThreshold,
    }));
  }

  async listStockCatalog(query: InventoryCatalogQueryDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: query.warehouseId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        isDefault: true,
        isActive: true,
      },
    });

    if (!warehouse) {
      throw new DomainException(ErrorCode.NOT_FOUND, 'Warehouse was not found.');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        product: { deletedAt: null },
      },
      orderBy: [{ productId: 'asc' }, { sku: 'asc' }],
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
        size: { select: { label: true } },
        product: {
          select: { id: true, name: true, slug: true, status: true },
        },
        inventories: {
          where: { warehouseId: query.warehouseId },
          take: 1,
          select: {
            id: true,
            onHand: true,
            reserved: true,
            lowStockThreshold: true,
            updatedAt: true,
          },
        },
      },
    });

    return variants.map((variant) => {
      const inventory = variant.inventories[0];
      const onHand = inventory?.onHand ?? 0;
      const reserved = inventory?.reserved ?? 0;
      const lowStockThreshold = inventory?.lowStockThreshold ?? 0;
      const available = onHand - reserved;

      return {
        inventoryId: inventory?.id ?? null,
        warehouse,
        variant: {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          isActive: variant.isActive,
          size: variant.size,
        },
        product: variant.product,
        onHand,
        reserved,
        available,
        lowStockThreshold,
        isLowStock: available <= lowStockThreshold,
        updatedAt: inventory?.updatedAt ?? null,
      };
    });
  }

  private toStockView(inventory: InventorySnapshot) {
    const available = inventory.onHand - inventory.reserved;

    return {
      ...inventory,
      available,
      isLowStock: available <= inventory.lowStockThreshold,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
