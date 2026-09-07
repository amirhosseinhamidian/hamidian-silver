import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { ProductStatus, StockNotificationStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateStockNotificationDto } from './dto/create-stock-notification.dto';

@Injectable()
export class StockNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(userId: string, dto: CreateStockNotificationDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        variants: {
          where: {
            isActive: true,
            deletedAt: null,
            ...(dto.variantId ? { id: dto.variantId } : {}),
          },
          select: {
            id: true,
            inventories: {
              where: {
                warehouse: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              select: {
                onHand: true,
                reserved: true,
              },
            },
          },
        },
      },
    });

    if (!product || (dto.variantId && product.variants.length !== 1)) {
      throw new DomainException(
        ErrorCode.STOCK_NOTIFICATION_TARGET_NOT_FOUND,
        'Stock notification target was not found.',
      );
    }

    const availableQuantity = product.variants.reduce(
      (productTotal, variant) =>
        productTotal +
        variant.inventories.reduce(
          (variantTotal, inventory) =>
            variantTotal + Math.max(0, inventory.onHand - inventory.reserved),
          0,
        ),
      0,
    );

    if (availableQuantity > 0) {
      throw new DomainException(
        ErrorCode.STOCK_ALREADY_AVAILABLE,
        'The selected product is already available.',
      );
    }

    const target = dto.variantId ? 'VARIANT' : 'PRODUCT';
    const existing = await this.findCurrentSubscription(userId, dto);

    if (existing) {
      return { subscribed: true, target } as const;
    }

    try {
      await this.prisma.stockNotificationSubscription.create({
        data: {
          id: randomUUID(),
          userId,
          productId: product.id,
          variantId: dto.variantId ?? null,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentSubscription = await this.findCurrentSubscription(userId, dto);
      if (!concurrentSubscription) {
        throw error;
      }
    }

    return { subscribed: true, target } as const;
  }

  async getAdminSummary() {
    const groups = await this.prisma.stockNotificationSubscription.groupBy({
      by: ['productId', 'variantId', 'status'],
      _count: { _all: true },
      _max: { createdAt: true, notifiedAt: true },
    });

    const productIds = [...new Set(groups.map((group) => group.productId))];
    const variantIds = [
      ...new Set(
        groups
          .map((group) => group.variantId)
          .filter((variantId): variantId is string => variantId !== null),
      ),
    ];
    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, name: true, slug: true, status: true },
      }),
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds }, deletedAt: null },
        select: {
          id: true,
          productId: true,
          sku: true,
          name: true,
          isActive: true,
          size: { select: { label: true } },
        },
      }),
    ]);
    const productsById = new Map(products.map((product) => [product.id, product]));
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const totals = { active: 0, queued: 0, notified: 0, cancelled: 0 };
    const targets = new Map<
      string,
      {
        productId: string;
        variantId: string | null;
        activeCount: number;
        queuedCount: number;
        notifiedCount: number;
        cancelledCount: number;
        lastRequestedAt: Date | null;
        lastNotifiedAt: Date | null;
      }
    >();

    for (const group of groups) {
      const count = group._count._all;
      const totalKey = group.status.toLowerCase() as keyof typeof totals;
      totals[totalKey] += count;
      const key = `${group.productId}:${group.variantId ?? 'product'}`;
      const current = targets.get(key) ?? {
        productId: group.productId,
        variantId: group.variantId,
        activeCount: 0,
        queuedCount: 0,
        notifiedCount: 0,
        cancelledCount: 0,
        lastRequestedAt: null,
        lastNotifiedAt: null,
      };
      const countKey = `${group.status.toLowerCase()}Count` as
        'activeCount' | 'queuedCount' | 'notifiedCount' | 'cancelledCount';
      current[countKey] += count;
      current.lastRequestedAt = this.latestDate(current.lastRequestedAt, group._max.createdAt);
      current.lastNotifiedAt = this.latestDate(current.lastNotifiedAt, group._max.notifiedAt);
      targets.set(key, current);
    }

    return {
      totals,
      targets: [...targets.values()]
        .map((target) => ({
          ...target,
          product: productsById.get(target.productId) ?? null,
          variant: target.variantId ? (variantsById.get(target.variantId) ?? null) : null,
        }))
        .filter((target) => target.product !== null)
        .sort((left, right) => {
          const leftWaiting = left.activeCount + left.queuedCount;
          const rightWaiting = right.activeCount + right.queuedCount;
          return rightWaiting - leftWaiting;
        }),
    };
  }

  private findCurrentSubscription(userId: string, dto: CreateStockNotificationDto) {
    return this.prisma.stockNotificationSubscription.findFirst({
      where: {
        userId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        status: {
          in: [StockNotificationStatus.ACTIVE, StockNotificationStatus.QUEUED],
        },
      },
      select: {
        id: true,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private latestDate(current: Date | null, candidate: Date | null): Date | null {
    if (!candidate) return current;
    if (!current || candidate.getTime() > current.getTime()) return candidate;
    return current;
  }
}
