import { Injectable } from '@nestjs/common';
import {
  OperationalAlertLevel,
  PaymentAttemptStatus,
  PaymentReconciliationStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  type EnqueueOperationalAlertInput,
  OperationalAlertOutboxService,
} from '../notifications/operational-alert-outbox.service';
import { ROLE_CODES } from '../authorization/rbac.constants';

const INITIATION_STUCK_AFTER_MS = 5 * 60 * 1000;
const RECONCILIATION_ALERT_AFTER_MS = 5 * 60 * 1000;
const ESCALATION_AFTER_MS = 30 * 60 * 1000;
const MAX_OBSERVABILITY_ROWS = 100;

@Injectable()
export class PaymentOperationalObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OperationalAlertOutboxService,
  ) {}

  async summary(now = new Date()) {
    const snapshot = await this.snapshot(now);

    return {
      generatedAt: now,
      stuckInitiations: snapshot.stuckInitiations.length,
      openReconciliations: snapshot.openReconciliations.length,
      escalatedInitiations: snapshot.stuckInitiations.filter((attempt) =>
        this.isEscalated(attempt.createdAt, now),
      ).length,
      escalatedReconciliations: snapshot.openReconciliations.filter((reconciliation) =>
        this.isEscalated(reconciliation.createdAt, now),
      ).length,
      byProvider: {
        stuckInitiations: this.countByProvider(snapshot.stuckInitiations),
        openReconciliations: this.countByProvider(snapshot.openReconciliations),
      },
    };
  }

  async scan(now = new Date()) {
    const snapshot = await this.snapshot(now);
    const candidates: EnqueueOperationalAlertInput[] = [
      ...snapshot.stuckInitiations.map((attempt) => this.initiationCandidate(attempt, now)),
      ...snapshot.openReconciliations
        .filter(
          (reconciliation) =>
            now.getTime() - reconciliation.createdAt.getTime() >= RECONCILIATION_ALERT_AFTER_MS,
        )
        .map((reconciliation) => this.reconciliationCandidate(reconciliation, now)),
    ];
    const enqueue = await this.outbox.enqueueMany(candidates, [ROLE_CODES.MANAGER]);

    return {
      scannedAt: now,
      stuckInitiationCount: snapshot.stuckInitiations.length,
      openReconciliationCount: snapshot.openReconciliations.length,
      alertCandidateCount: candidates.length,
      ...enqueue,
    };
  }

  private async snapshot(now: Date) {
    const initiationCutoff = new Date(now.getTime() - INITIATION_STUCK_AFTER_MS);

    const [stuckInitiations, openReconciliations] = await Promise.all([
      this.prisma.paymentAttempt.findMany({
        where: {
          status: PaymentAttemptStatus.CREATED,
          createdAt: {
            lte: initiationCutoff,
          },
        },
        take: MAX_OBSERVABILITY_ROWS,
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          provider: true,
          amountToman: true,
          createdAt: true,
          updatedAt: true,
          payment: {
            select: {
              status: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.paymentReconciliation.findMany({
        where: {
          status: PaymentReconciliationStatus.OPEN,
        },
        take: MAX_OBSERVABILITY_ROWS,
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          provider: true,
          amountToman: true,
          reason: true,
          createdAt: true,
          paymentAttempt: {
            select: {
              id: true,
              payment: {
                select: {
                  status: true,
                  order: {
                    select: {
                      id: true,
                      orderNumber: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      stuckInitiations,
      openReconciliations,
    };
  }

  private initiationCandidate(
    attempt: {
      id: string;
      provider: string;
      amountToman: number;
      createdAt: Date;
      payment: {
        status: string;
        order: {
          id: string;
          orderNumber: string;
          status: string;
        };
      };
    },
    now: Date,
  ): EnqueueOperationalAlertInput {
    const escalated = this.isEscalated(attempt.createdAt, now);

    return {
      orderId: attempt.payment.order.id,
      orderNumber: attempt.payment.order.orderNumber,
      code: 'PAYMENT_INITIATION_STUCK',
      level: escalated ? OperationalAlertLevel.ESCALATION : OperationalAlertLevel.INITIAL,
      priority: escalated ? 'CRITICAL' : 'HIGH',
      incidentFingerprint: `PAYMENT_INITIATION_STUCK:${attempt.id}`,
      dueAt: new Date(attempt.createdAt.getTime() + INITIATION_STUCK_AFTER_MS),
      payload: {
        paymentAttemptId: attempt.id,
        provider: attempt.provider,
        amountToman: attempt.amountToman,
        paymentStatus: attempt.payment.status,
        orderStatus: attempt.payment.order.status,
        ageMinutes: this.ageMinutes(attempt.createdAt, now),
      },
    };
  }

  private reconciliationCandidate(
    reconciliation: {
      id: string;
      provider: string;
      amountToman: number;
      createdAt: Date;
      paymentAttempt: {
        id: string;
        payment: {
          status: string;
          order: {
            id: string;
            orderNumber: string;
            status: string;
          };
        };
      };
    },
    now: Date,
  ): EnqueueOperationalAlertInput {
    const escalated = this.isEscalated(reconciliation.createdAt, now);

    return {
      orderId: reconciliation.paymentAttempt.payment.order.id,
      orderNumber: reconciliation.paymentAttempt.payment.order.orderNumber,
      code: 'PAYMENT_RECONCILIATION_OPEN',
      level: escalated ? OperationalAlertLevel.ESCALATION : OperationalAlertLevel.INITIAL,
      priority: escalated ? 'CRITICAL' : 'HIGH',
      incidentFingerprint: `PAYMENT_RECONCILIATION_OPEN:${reconciliation.id}`,
      dueAt: new Date(reconciliation.createdAt.getTime() + RECONCILIATION_ALERT_AFTER_MS),
      payload: {
        paymentReconciliationId: reconciliation.id,
        paymentAttemptId: reconciliation.paymentAttempt.id,
        provider: reconciliation.provider,
        amountToman: reconciliation.amountToman,
        paymentStatus: reconciliation.paymentAttempt.payment.status,
        orderStatus: reconciliation.paymentAttempt.payment.order.status,
        ageMinutes: this.ageMinutes(reconciliation.createdAt, now),
      },
    };
  }

  private isEscalated(createdAt: Date, now: Date) {
    return now.getTime() - createdAt.getTime() >= ESCALATION_AFTER_MS;
  }

  private ageMinutes(createdAt: Date, now: Date) {
    return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000));
  }

  private countByProvider(rows: Array<{ provider: string }>) {
    return Object.fromEntries(
      [...new Set(rows.map((row) => row.provider))].map((provider) => [
        provider,
        rows.filter((row) => row.provider === provider).length,
      ]),
    );
  }
}
