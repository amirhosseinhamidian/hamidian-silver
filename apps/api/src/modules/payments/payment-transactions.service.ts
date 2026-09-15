import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListPaymentAttemptsQueryDto } from './dto/list-payment-attempts-query.dto';

const PAYMENT_ATTEMPT_SELECT = {
  id: true,
  provider: true,
  status: true,
  amountToman: true,
  authority: true,
  providerReference: true,
  failureCode: true,
  failureMessage: true,
  verifiedAt: true,
  initiationRecoveryResolution: true,
  initiationRecoveryNote: true,
  initiationRecoveryResolvedAt: true,
  createdAt: true,
  updatedAt: true,
  initiationRecoveryResolvedBy: {
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  },
  reconciliation: {
    select: {
      id: true,
      status: true,
      reason: true,
      resolution: true,
      externalReference: true,
      resolvedAt: true,
    },
  },
  payment: {
    select: {
      id: true,
      status: true,
      amountToman: true,
      refundedAmountToman: true,
      paidAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotalToman: true,
          user: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentAttemptSelect;

@Injectable()
export class PaymentTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPaymentAttemptsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.buildWhere(query);
    const [items, total, statusGroups, providerGroups, amount] = await Promise.all([
      this.prisma.paymentAttempt.findMany({
        where,
        select: PAYMENT_ATTEMPT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentAttempt.count({ where }),
      this.prisma.paymentAttempt.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.paymentAttempt.groupBy({
        by: ['provider'],
        where,
        _count: { _all: true },
      }),
      this.prisma.paymentAttempt.aggregate({
        where,
        _sum: { amountToman: true },
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      summary: {
        totalAmountToman: amount._sum.amountToman ?? 0,
        byStatus: Object.fromEntries(
          statusGroups.map((group) => [group.status, group._count._all]),
        ),
        byProvider: Object.fromEntries(
          providerGroups.map((group) => [group.provider, group._count._all]),
        ),
      },
    };
  }

  private buildWhere(query: ListPaymentAttemptsQueryDto): Prisma.PaymentAttemptWhereInput {
    const q = query.q?.trim();

    return {
      provider: query.provider,
      status: query.status,
      OR: q
        ? [
            { provider: { contains: q, mode: 'insensitive' } },
            { authority: { contains: q, mode: 'insensitive' } },
            { providerReference: { contains: q, mode: 'insensitive' } },
            { failureCode: { contains: q, mode: 'insensitive' } },
            { failureMessage: { contains: q, mode: 'insensitive' } },
            {
              payment: {
                order: {
                  OR: [
                    { orderNumber: { contains: q, mode: 'insensitive' } },
                    { user: { phone: { contains: q } } },
                    { user: { firstName: { contains: q, mode: 'insensitive' } } },
                    { user: { lastName: { contains: q, mode: 'insensitive' } } },
                  ],
                },
              },
            },
          ]
        : undefined,
    };
  }
}
