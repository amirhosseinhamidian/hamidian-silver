import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CatalogMerchandisingEntry, Prisma } from '../../generated/prisma/client';
import { ProductStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { catalogHierarchyTransaction } from './catalog-hierarchy-transaction';
import type {
  CatalogMerchandisingDto,
  UpdateCatalogMerchandisingDto,
} from './dto/catalog-merchandising.dto';

const MAX_SCHEDULED_ENTRIES = 24;
const MAX_SCHEDULE_MS = 90 * 24 * 60 * 60 * 1000;

function settings(entry: CatalogMerchandisingEntry | null): CatalogMerchandisingDto {
  return {
    enabled: entry?.enabled ?? false,
    pinned: entry?.pinned ?? false,
    weight: entry?.weight ?? 0,
    startsAt: entry?.startsAt?.toISOString() ?? null,
    endsAt: entry?.endsAt?.toISOString() ?? null,
    revision: entry?.revision ?? 0,
  };
}

@Injectable()
export class CatalogMerchandisingService {
  constructor(private readonly prisma: PrismaService) {}

  private async product(db: Pick<Prisma.TransactionClient, 'product'>, productId: string) {
    const product = await db.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { name: true, status: true, catalogMerchandising: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async read(productId: string): Promise<CatalogMerchandisingDto> {
    const { catalogMerchandising } = await this.product(this.prisma, productId);
    return settings(catalogMerchandising);
  }

  async update(
    productId: string,
    input: UpdateCatalogMerchandisingDto,
  ): Promise<CatalogMerchandisingDto> {
    return catalogHierarchyTransaction(this.prisma, async (db) => {
      const { catalogMerchandising, name, status } = await this.product(db, productId);
      const revision = catalogMerchandising?.revision ?? 0;
      if (revision !== input.expectedRevision) {
        throw new ConflictException('Merchandising settings changed. Reload and retry.');
      }

      const now = new Date();
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if (
        (startsAt && Number.isNaN(startsAt.getTime())) ||
        (endsAt && Number.isNaN(endsAt.getTime()))
      ) {
        throw new BadRequestException('Start and end must be valid timestamps.');
      }
      if (input.enabled) {
        if (status !== ProductStatus.ACTIVE) {
          throw new BadRequestException('Only published products can be featured.');
        }
        if (
          !startsAt ||
          !endsAt ||
          endsAt <= now ||
          startsAt >= endsAt ||
          endsAt.getTime() - startsAt.getTime() > MAX_SCHEDULE_MS ||
          (!input.pinned && input.weight === 0)
        ) {
          throw new BadRequestException(
            'Choose a pin or positive weight and a valid period up to 90 days.',
          );
        }
        const reservedSlots = await db.catalogMerchandisingEntry.count({
          where: { productId: { not: productId }, enabled: true, endsAt: { gt: now } },
        });
        if (reservedSlots >= MAX_SCHEDULED_ENTRIES) {
          throw new ConflictException(
            'The limit of 24 active or scheduled featured products is reached.',
          );
        }
      }
      const data = {
        enabled: input.enabled,
        pinned: input.pinned,
        weight: input.weight,
        startsAt,
        endsAt,
      };
      const entry = await db.catalogMerchandisingEntry.upsert({
        where: { productId },
        create: { productId, ...data },
        update: { ...data, revision: { increment: 1 } },
      });
      const before = settings(catalogMerchandising);
      const after = settings(entry);
      const fields = {
        enabled: 'فعال بودن',
        pinned: 'سنجاق',
        weight: 'وزن',
        startsAt: 'شروع',
        endsAt: 'پایان',
      } as const;
      return attachHumanAuditEvent(after, {
        title: 'ویرایش اولویت نمایش محصول',
        operationType: 'UPDATE',
        entityName: name,
        changes: (Object.keys(fields) as (keyof typeof fields)[])
          .filter((field) => before[field] !== after[field])
          .map((field) => ({
            field,
            label: fields[field],
            before: before[field],
            after: after[field],
          })),
      });
    });
  }
}
