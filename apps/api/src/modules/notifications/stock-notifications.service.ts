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
}
