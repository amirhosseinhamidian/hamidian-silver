import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import {
  SupplierCreditApplicationStatus,
  SupplierCreditStatus,
  SupplierPayableStatus,
  SupplierSettlementStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApplySupplierCreditDto } from './dto/apply-supplier-credit.dto';
import { CancelSupplierSettlementDto } from './dto/cancel-supplier-settlement.dto';
import { CreateSupplierSettlementDto } from './dto/create-supplier-settlement.dto';
import { ListSupplierSettlementsQueryDto } from './dto/list-supplier-settlements-query.dto';
import { PaySupplierSettlementDto } from './dto/pay-supplier-settlement.dto';
import { RemoveSupplierCreditApplicationDto } from './dto/remove-supplier-credit-application.dto';

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
        creditApplications: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            supplierCredit: true,
            appliedBy: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
            removedBy: {
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
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

      if (!isNonNegativeTomanInt(totalAmountToman)) {
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

  async applyCredit(settlementId: string, actorUserId: string, dto: ApplySupplierCreditDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.supplierCreditApplication.findUnique({
          where: {
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (existing) {
          if (
            existing.settlementId !== settlementId ||
            existing.supplierCreditId !== dto.supplierCreditId ||
            existing.amountToman !== dto.amountToman
          ) {
            throw new ConflictException(
              'Supplier credit application idempotency key is already in use.',
            );
          }

          return existing;
        }

        const settlement = await transaction.supplierSettlement.findUnique({
          where: {
            id: settlementId,
          },
        });

        if (!settlement) {
          throw new NotFoundException('Supplier settlement was not found.');
        }

        if (settlement.status !== SupplierSettlementStatus.DRAFT) {
          throw new ConflictException('Supplier credits can only be applied to draft settlements.');
        }

        const credit = await transaction.supplierCredit.findUnique({
          where: {
            id: dto.supplierCreditId,
          },
        });

        if (!credit) {
          throw new NotFoundException('Supplier credit was not found.');
        }

        if (credit.status === SupplierCreditStatus.VOIDED) {
          throw new ConflictException('Voided supplier credit cannot be applied.');
        }

        if (credit.supplierIdSnapshot !== settlement.supplierIdSnapshot) {
          throw new BadRequestException(
            'Supplier credit and settlement must belong to the same supplier.',
          );
        }

        const settlementApplied = settlement.creditAppliedToman ?? 0;
        const creditApplied = credit.appliedAmountToman ?? 0;
        const settlementRemaining = settlement.totalAmountToman - settlementApplied;
        const creditRemaining = credit.amountToman - creditApplied;

        if (dto.amountToman > settlementRemaining || dto.amountToman > creditRemaining) {
          throw new ConflictException(
            'Supplier credit application exceeds the remaining settlement or credit amount.',
          );
        }

        const claimedSettlement = await transaction.supplierSettlement.updateMany({
          where: {
            id: settlement.id,
            status: SupplierSettlementStatus.DRAFT,
            creditAppliedToman: settlementApplied,
          },
          data: {
            creditAppliedToman: {
              increment: dto.amountToman,
            },
          },
        });

        if (claimedSettlement.count !== 1) {
          throw new ConflictException(
            'Supplier settlement credit total changed; reload and retry.',
          );
        }

        const claimedCredit = await transaction.supplierCredit.updateMany({
          where: {
            id: credit.id,
            status: {
              in: [SupplierCreditStatus.AVAILABLE, SupplierCreditStatus.PARTIALLY_APPLIED],
            },
            appliedAmountToman: creditApplied,
          },
          data: {
            appliedAmountToman: {
              increment: dto.amountToman,
            },
          },
        });

        if (claimedCredit.count !== 1) {
          throw new ConflictException('Supplier credit balance changed; reload and retry.');
        }

        const nextAppliedAmount = creditApplied + dto.amountToman;
        const nextStatus =
          nextAppliedAmount === credit.amountToman
            ? SupplierCreditStatus.APPLIED
            : SupplierCreditStatus.PARTIALLY_APPLIED;

        await transaction.supplierCredit.update({
          where: {
            id: credit.id,
          },
          data: {
            status: nextStatus,
            appliedAt: nextStatus === SupplierCreditStatus.APPLIED ? new Date() : null,
          },
        });

        return transaction.supplierCreditApplication.create({
          data: {
            settlementId: settlement.id,
            supplierCreditId: credit.id,
            idempotencyKey: dto.idempotencyKey,
            amountToman: dto.amountToman,
            appliedByUserId: actorUserId,
          },
          include: {
            supplierCredit: true,
            settlement: true,
            appliedBy: {
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
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.supplierCreditApplication.findUnique({
        where: {
          idempotencyKey: dto.idempotencyKey,
        },
      });

      if (
        !existing ||
        existing.settlementId !== settlementId ||
        existing.supplierCreditId !== dto.supplierCreditId ||
        existing.amountToman !== dto.amountToman
      ) {
        throw new ConflictException(
          'Supplier credit application idempotency key is already in use.',
        );
      }

      return existing;
    }
  }

  async removeCredit(
    settlementId: string,
    applicationId: string,
    actorUserId: string,
    dto: RemoveSupplierCreditApplicationDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.supplierCreditApplication.findUnique({
        where: {
          id: applicationId,
        },
        include: {
          settlement: true,
          supplierCredit: true,
        },
      });

      if (!application || application.settlementId !== settlementId) {
        throw new NotFoundException('Supplier credit application was not found.');
      }

      if (application.status === SupplierCreditApplicationStatus.REMOVED) {
        return application;
      }

      if (application.settlement.status !== SupplierSettlementStatus.DRAFT) {
        throw new ConflictException('Supplier credit can only be removed from a draft settlement.');
      }

      const settlementApplied = application.settlement.creditAppliedToman ?? 0;
      const creditApplied = application.supplierCredit.appliedAmountToman ?? 0;

      if (settlementApplied < application.amountToman || creditApplied < application.amountToman) {
        throw new ConflictException('Supplier credit application totals are inconsistent.');
      }

      const claimedSettlement = await transaction.supplierSettlement.updateMany({
        where: {
          id: application.settlement.id,
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman: settlementApplied,
        },
        data: {
          creditAppliedToman: {
            decrement: application.amountToman,
          },
        },
      });

      if (claimedSettlement.count !== 1) {
        throw new ConflictException('Supplier settlement credit total changed; reload and retry.');
      }

      const releasedCredit = await transaction.supplierCredit.updateMany({
        where: {
          id: application.supplierCredit.id,
          appliedAmountToman: creditApplied,
          status: {
            not: SupplierCreditStatus.VOIDED,
          },
        },
        data: {
          appliedAmountToman: {
            decrement: application.amountToman,
          },
        },
      });

      if (releasedCredit.count !== 1) {
        throw new ConflictException('Supplier credit balance changed; reload and retry.');
      }

      const removed = await transaction.supplierCreditApplication.updateMany({
        where: {
          id: application.id,
          status: SupplierCreditApplicationStatus.ACTIVE,
        },
        data: {
          status: SupplierCreditApplicationStatus.REMOVED,
          removedByUserId: actorUserId,
          removedAt: new Date(),
          removalReason: dto.reason,
        },
      });

      if (removed.count !== 1) {
        throw new ConflictException('Supplier credit application state changed; reload and retry.');
      }

      await this.refreshCreditState(
        transaction,
        application.supplierCredit.id,
        creditApplied - application.amountToman,
        application.supplierCredit.amountToman,
      );

      return transaction.supplierCreditApplication.findUniqueOrThrow({
        where: {
          id: application.id,
        },
        include: {
          supplierCredit: true,
          settlement: true,
          appliedBy: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
          removedBy: {
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
          creditApplications: {
            where: {
              status: SupplierCreditApplicationStatus.ACTIVE,
            },
          },
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

      const creditAppliedToman = settlement.creditAppliedToman ?? 0;
      const creditApplications = settlement.creditApplications ?? [];
      const applicationTotal = creditApplications.reduce(
        (total, application) => total + application.amountToman,
        0,
      );

      if (
        applicationTotal !== creditAppliedToman ||
        creditAppliedToman < 0 ||
        creditAppliedToman > settlement.totalAmountToman
      ) {
        throw new ConflictException('Supplier settlement credit applications are inconsistent.');
      }

      const paidAmountToman = settlement.totalAmountToman - creditAppliedToman;
      const paidAt = new Date();

      try {
        await transaction.supplierSettlement.update({
          where: {
            id: settlement.id,
            status: SupplierSettlementStatus.DRAFT,
            creditAppliedToman,
          },
          data: {
            creditAppliedToman,
          },
        });
      } catch (error) {
        if (this.isRecordNotFoundError(error)) {
          const current = await transaction.supplierSettlement.findUnique({
            where: {
              id: settlement.id,
            },
          });

          if (current?.status === SupplierSettlementStatus.PAID) {
            return current;
          }

          if (current?.status === SupplierSettlementStatus.CANCELLED) {
            throw new ConflictException(
              'Supplier settlement was cancelled while payment was being recorded.',
            );
          }

          throw new ConflictException(
            'Supplier settlement changed while payment was being recorded.',
          );
        }

        throw error;
      }

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
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman,
        },
        data: {
          status: SupplierSettlementStatus.PAID,
          paidAmountToman,
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
          creditApplications: {
            where: {
              status: SupplierCreditApplicationStatus.ACTIVE,
            },
            include: {
              supplierCredit: true,
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
        include: {
          creditApplications: {
            where: {
              status: SupplierCreditApplicationStatus.ACTIVE,
            },
            include: {
              supplierCredit: true,
            },
          },
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

      const creditAppliedToman = settlement.creditAppliedToman ?? 0;
      const creditApplications = settlement.creditApplications ?? [];
      const applicationTotal = creditApplications.reduce(
        (total, application) => total + application.amountToman,
        0,
      );

      if (applicationTotal !== creditAppliedToman) {
        throw new ConflictException('Supplier settlement credit applications are inconsistent.');
      }

      try {
        await transaction.supplierSettlement.update({
          where: {
            id: settlement.id,
            status: SupplierSettlementStatus.DRAFT,
            creditAppliedToman,
          },
          data: {
            creditAppliedToman,
          },
        });
      } catch (error) {
        if (this.isRecordNotFoundError(error)) {
          const current = await transaction.supplierSettlement.findUnique({
            where: {
              id: settlement.id,
            },
          });

          if (current?.status === SupplierSettlementStatus.CANCELLED) {
            return current;
          }

          if (current?.status === SupplierSettlementStatus.PAID) {
            throw new ConflictException('Paid supplier settlements cannot be cancelled.');
          }

          throw new ConflictException(
            'Supplier settlement changed while cancellation was being recorded.',
          );
        }

        throw error;
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

      for (const application of creditApplications) {
        const currentCredit = await transaction.supplierCredit.findUnique({
          where: {
            id: application.supplierCredit.id,
          },
        });

        if (!currentCredit) {
          throw new ConflictException(
            'Supplier credit disappeared while cancelling the settlement.',
          );
        }

        const currentApplied = currentCredit.appliedAmountToman ?? 0;

        if (currentApplied < application.amountToman) {
          throw new ConflictException('Supplier credit application balance is inconsistent.');
        }

        const releasedCredit = await transaction.supplierCredit.updateMany({
          where: {
            id: currentCredit.id,
            appliedAmountToman: currentApplied,
            status: {
              not: SupplierCreditStatus.VOIDED,
            },
          },
          data: {
            appliedAmountToman: {
              decrement: application.amountToman,
            },
          },
        });

        if (releasedCredit.count !== 1) {
          throw new ConflictException(
            'Supplier credit balance changed while cancelling the settlement.',
          );
        }

        const removed = await transaction.supplierCreditApplication.updateMany({
          where: {
            id: application.id,
            status: SupplierCreditApplicationStatus.ACTIVE,
          },
          data: {
            status: SupplierCreditApplicationStatus.REMOVED,
            removedByUserId: actorUserId,
            removedAt: new Date(),
            removalReason: dto.reason ?? 'Supplier settlement cancelled.',
          },
        });

        if (removed.count !== 1) {
          throw new ConflictException(
            'Supplier credit application changed while cancelling the settlement.',
          );
        }

        await this.refreshCreditState(
          transaction,
          currentCredit.id,
          currentApplied - application.amountToman,
          currentCredit.amountToman,
        );
      }

      return transaction.supplierSettlement.update({
        where: {
          id: settlement.id,
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman,
        },
        data: {
          status: SupplierSettlementStatus.CANCELLED,
          creditAppliedToman: 0,
          paidAmountToman: null,
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
          creditApplications: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              supplierCredit: true,
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

  private async refreshCreditState(
    transaction: Prisma.TransactionClient,
    creditId: string,
    appliedAmountToman: number,
    totalAmountToman: number,
  ) {
    if (
      !Number.isSafeInteger(appliedAmountToman) ||
      appliedAmountToman < 0 ||
      appliedAmountToman > totalAmountToman
    ) {
      throw new ConflictException('Supplier credit balance is inconsistent.');
    }

    const status =
      appliedAmountToman === 0
        ? SupplierCreditStatus.AVAILABLE
        : appliedAmountToman === totalAmountToman
          ? SupplierCreditStatus.APPLIED
          : SupplierCreditStatus.PARTIALLY_APPLIED;

    await transaction.supplierCredit.update({
      where: {
        id: creditId,
      },
      data: {
        status,
        appliedAt: status === SupplierCreditStatus.APPLIED ? new Date() : null,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
  }
}
