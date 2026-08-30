import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplierPayableStatus, SupplierSettlementStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CancelSupplierSettlementDto } from './dto/cancel-supplier-settlement.dto';
import { CreateSupplierSettlementDto } from './dto/create-supplier-settlement.dto';
import { ListSupplierSettlementsQueryDto } from './dto/list-supplier-settlements-query.dto';
import { PaySupplierSettlementDto } from './dto/pay-supplier-settlement.dto';

@Injectable()
export class SupplierSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListSupplierSettlementsQueryDto) {
    return this.prisma.supplierSettlement.findMany({
      where: {
        status: query.status,
        supplierIdSnapshot: query.supplierId,
      },
      take: query.limit ?? 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        paidBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async get(settlementId: string) {
    const settlement = await this.prisma.supplierSettlement.findUnique({
      where: {
        id: settlementId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            payable: {
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    paidAt: true,
                  },
                },
                orderItem: {
                  select: {
                    id: true,
                    productNameSnapshot: true,
                    variantNameSnapshot: true,
                    skuSnapshot: true,
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        paidBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Supplier settlement was not found.');
    }

    return settlement;
  }

  async create(actorUserId: string, dto: CreateSupplierSettlementDto) {
    return this.prisma.$transaction(async (transaction) => {
      const payables = await transaction.supplierPayable.findMany({
        where: {
          id: {
            in: dto.payableIds,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (payables.length !== dto.payableIds.length) {
        throw new NotFoundException('One or more supplier payables were not found.');
      }

      if (payables.some(({ status }) => status !== SupplierPayableStatus.OPEN)) {
        throw new ConflictException('Only open supplier payables can be settled.');
      }

      if (payables.some(({ settlementId }) => settlementId !== null)) {
        throw new ConflictException(
          'One or more supplier payables already belong to a settlement.',
        );
      }

      const supplierId = payables[0]?.supplierIdSnapshot;

      if (!supplierId) {
        throw new BadRequestException('Supplier settlement requires at least one payable.');
      }

      if (payables.some(({ supplierIdSnapshot }) => supplierIdSnapshot !== supplierId)) {
        throw new BadRequestException(
          'All supplier payables in a settlement must belong to the same supplier.',
        );
      }

      const totalAmountToman = payables.reduce((total, payable) => total + payable.amountToman, 0);

      if (!Number.isSafeInteger(totalAmountToman) || totalAmountToman < 0) {
        throw new BadRequestException('Supplier settlement total exceeds the supported range.');
      }

      const settlement = await transaction.supplierSettlement.create({
        data: {
          supplierIdSnapshot: supplierId,
          supplierNameSnapshot: payables[0].supplierNameSnapshot,
          totalAmountToman,
          payableCount: payables.length,
          createdByUserId: actorUserId,
          note: dto.note,
        },
      });

      const claimed = await transaction.supplierPayable.updateMany({
        where: {
          id: {
            in: dto.payableIds,
          },
          status: SupplierPayableStatus.OPEN,
          settlementId: null,
        },
        data: {
          settlementId: settlement.id,
        },
      });

      if (claimed.count !== payables.length) {
        throw new ConflictException('Supplier payable settlement state changed; reload and retry.');
      }

      await transaction.supplierSettlementItem.createMany({
        data: payables.map((payable) => ({
          settlementId: settlement.id,
          payableId: payable.id,
          amountToman: payable.amountToman,
        })),
      });

      return transaction.supplierSettlement.findUniqueOrThrow({
        where: {
          id: settlement.id,
        },
        include: {
          items: {
            include: {
              payable: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  async pay(settlementId: string, actorUserId: string, dto: PaySupplierSettlementDto) {
    return this.prisma.$transaction(async (transaction) => {
      const settlement = await transaction.supplierSettlement.findUnique({
        where: {
          id: settlementId,
        },
        include: {
          payables: true,
          items: true,
        },
      });

      if (!settlement) {
        throw new NotFoundException('Supplier settlement was not found.');
      }

      if (settlement.status === SupplierSettlementStatus.PAID) {
        return settlement;
      }

      if (settlement.status !== SupplierSettlementStatus.DRAFT) {
        throw new ConflictException('Only draft supplier settlements can be paid.');
      }

      if (
        settlement.payables.length !== settlement.payableCount ||
        settlement.items.length !== settlement.payableCount
      ) {
        throw new ConflictException('Supplier settlement membership is inconsistent.');
      }

      if (settlement.payables.some(({ status }) => status !== SupplierPayableStatus.OPEN)) {
        throw new ConflictException('One or more supplier payables are no longer open.');
      }

      const payableTotal = settlement.payables.reduce(
        (total, payable) => total + payable.amountToman,
        0,
      );

      if (payableTotal !== settlement.totalAmountToman) {
        throw new ConflictException('Supplier settlement total is inconsistent.');
      }

      const paidAt = new Date();
      const updatedPayables = await transaction.supplierPayable.updateMany({
        where: {
          settlementId: settlement.id,
          status: SupplierPayableStatus.OPEN,
        },
        data: {
          status: SupplierPayableStatus.PAID,
          paidByUserId: actorUserId,
          paidAt,
          paymentReference: dto.paymentReference,
          settlementNote: dto.note ?? settlement.note,
        },
      });

      if (updatedPayables.count !== settlement.payableCount) {
        throw new ConflictException('Supplier payable status changed while settling the batch.');
      }

      return transaction.supplierSettlement.update({
        where: {
          id: settlement.id,
        },
        data: {
          status: SupplierSettlementStatus.PAID,
          paidByUserId: actorUserId,
          paidAt,
          paymentReference: dto.paymentReference,
          note: dto.note ?? settlement.note,
        },
        include: {
          items: {
            include: {
              payable: true,
            },
          },
          paidBy: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  async cancel(settlementId: string, actorUserId: string, dto: CancelSupplierSettlementDto) {
    return this.prisma.$transaction(async (transaction) => {
      const settlement = await transaction.supplierSettlement.findUnique({
        where: {
          id: settlementId,
        },
      });

      if (!settlement) {
        throw new NotFoundException('Supplier settlement was not found.');
      }

      if (settlement.status === SupplierSettlementStatus.CANCELLED) {
        return settlement;
      }

      if (settlement.status !== SupplierSettlementStatus.DRAFT) {
        throw new ConflictException('Only draft supplier settlements can be cancelled.');
      }

      const released = await transaction.supplierPayable.updateMany({
        where: {
          settlementId: settlement.id,
          status: SupplierPayableStatus.OPEN,
        },
        data: {
          settlementId: null,
        },
      });

      if (released.count !== settlement.payableCount) {
        throw new ConflictException(
          'Supplier settlement membership changed while cancelling the batch.',
        );
      }

      return transaction.supplierSettlement.update({
        where: {
          id: settlement.id,
        },
        data: {
          status: SupplierSettlementStatus.CANCELLED,
          cancelledByUserId: actorUserId,
          cancelledAt: new Date(),
          note: dto.reason ?? settlement.note,
        },
        include: {
          items: {
            include: {
              payable: true,
            },
          },
          cancelledBy: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }
}
