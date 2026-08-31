import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isNonNegativeInt32, isSignedInt32 } from '../../common/int32';
import { InventoryMovementType } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { BulkSetStockDto } from './dto/bulk-set-stock.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { SetLowStockThresholdDto } from './dto/set-low-stock-threshold.dto';

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

  createWarehouse(dto: CreateWarehouseDto) {
    if (!dto.isDefault) {
      return this.prisma.warehouse.create({
        data: {
          code: dto.code,
          name: dto.name,
          isDefault: false,
          isActive: dto.isActive ?? true,
        },
      });
    }

    return this.prisma.$transaction(async (transaction) => {
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
          code: dto.code,
          name: dto.name,
          isDefault: true,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  listWarehouses() {
    return this.prisma.warehouse.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async adjustStock(dto: AdjustStockDto, actorUserId: string) {
    if (!isSignedInt32(dto.onHandDelta) || dto.onHandDelta === 0) {
      throw new BadRequestException('Stock adjustment exceeds the supported range.');
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
        throw new NotFoundException('Warehouse was not found.');
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
        throw new NotFoundException('Product variant was not found.');
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
        throw new BadRequestException('Stock cannot be reduced below zero.');
      }

      const nextOnHand = (current?.onHand ?? 0) + dto.onHandDelta;
      const reserved = current?.reserved ?? 0;

      if (!isNonNegativeInt32(nextOnHand)) {
        throw new BadRequestException('Stock quantity exceeds the supported range.');
      }

      if (nextOnHand < reserved) {
        throw new BadRequestException('On-hand stock cannot be lower than reserved stock.');
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
          throw new ConflictException('Inventory changed while adjusting stock; reload and retry.');
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
            throw new ConflictException(
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

      return this.toStockView(inventory);
    });
  }

  async bulkSetStock(dto: BulkSetStockDto, actorUserId: string) {
    if (!isNonNegativeInt32(dto.onHand)) {
      throw new BadRequestException('Bulk stock quantity exceeds the supported range.');
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
        throw new NotFoundException('Warehouse was not found.');
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
        throw new NotFoundException('One or more product variants were not found.');
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
          throw new BadRequestException('Bulk stock quantity cannot be lower than reserved stock.');
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
            throw new ConflictException(
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
              throw new ConflictException(
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
      throw new BadRequestException('Low-stock threshold exceeds the supported range.');
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
        throw new NotFoundException('Warehouse was not found.');
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
        throw new NotFoundException('Product variant was not found.');
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
