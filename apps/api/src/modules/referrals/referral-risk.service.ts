import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { ReferralRiskAssessment, ReferralRiskReview } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type {
  ReferralRiskCaseDto,
  ReferralRiskEvidenceDto,
  ReferralRiskPolicyDto,
  ReferralRiskQueueDto,
  ReviewReferralRiskDto,
  RiskAction,
} from './dto/referral-risk.dto';
import { ReferralRiskEvidenceService } from './referral-risk-evidence.service';
import { assessReferralRisk } from './referral-risk-engine';
import { ReferralRiskPoliciesService } from './referral-risk-policies.service';

const hour = 3_600_000;
const day = 24 * hour;
const pageSize = 25;
const openActions = ['REVIEW', 'HOLD'] as const;
type EligibleClaim = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  firstOrderId: string;
  claimedAt: Date;
  firstPaidAt: Date;
};

function dueAt(action: RiskAction, now: Date, hours: number) {
  return action === 'HOLD' || action === 'REVIEW' ? new Date(+now + hours * hour) : null;
}

function caseDto(
  row: ReferralRiskAssessment,
  now: Date,
  reviews: ReferralRiskReview[] = [],
): ReferralRiskCaseDto {
  return {
    attributionId: row.attributionId,
    orderId: row.orderId,
    policyVersion: row.policyVersion,
    autoAction: row.autoAction,
    action: row.action,
    confidence: row.confidence,
    score: row.score,
    revision: row.revision,
    assessedAt: row.assessedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    overdue: row.dueAt !== null && row.dueAt <= now,
    evidence:
      +now < +row.expiresAt && Array.isArray(row.evidence)
        ? (row.evidence as unknown as ReferralRiskEvidenceDto[])
        : null,
    reviews: reviews.map((review) => ({
      revision: review.revision,
      fromAction: review.fromAction,
      action: review.action,
      reason: review.reason,
      actorUserId: review.actorUserId,
      recordedAt: review.recordedAt.toISOString(),
    })),
  };
}

@Injectable()
export class ReferralRiskService {
  private readonly logger = new Logger(ReferralRiskService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly policies: ReferralRiskPoliciesService,
    private readonly evidence: ReferralRiskEvidenceService,
  ) {}

  async run(now = new Date()) {
    const candidates = await this.db.$queryRaw<EligibleClaim[]>`
      SELECT a.id, a."referrerUserId", a."referredUserId", a."claimedAt", a."firstOrderId", a."firstPaidAt"
      FROM "referral_attributions" a
      JOIN "referral_reward_policy_versions" reward ON reward.version = a."rewardPolicyVersion"
      WHERE a."firstOrderId" IS NOT NULL AND a."firstPaidAt" >= a."claimedAt"
        AND (
          a."firstPaidAt" < a."expiresAt"
          OR EXISTS (
            SELECT 1 FROM "orders" o WHERE o.id = a."firstOrderId" AND o."referralCheckoutAttributionId" = a.id
          )
        )
        AND a."firstPaidAt" <= ${now}
        AND reward.definition->'enabled' = 'true'::jsonb
        AND NOT EXISTS (SELECT 1 FROM "referral_risk_assessments" r WHERE r."attributionId" = a.id)
      ORDER BY a."firstPaidAt", a.id LIMIT 20
    `;
    if (!candidates.length) return 0;
    const policy = await this.policies.active();
    let created = 0;
    for (const claim of candidates) {
      try {
        const metrics = await this.evidence.collect(claim, policy.definition, now);
        const result = assessReferralRisk(policy.definition, metrics, claim.id, now);
        const snapshot = {
          ...policy.definition,
          exceptions: policy.definition.exceptions.filter(
            ({ attributionId }) => attributionId.toLowerCase() === claim.id,
          ),
        };
        const record = await this.db.referralRiskAssessment.createMany({
          data: {
            attributionId: claim.id,
            orderId: claim.firstOrderId,
            policyVersion: policy.version,
            policySnapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonObject,
            action: result.action,
            autoAction: result.action,
            confidence: result.confidence,
            score: result.score,
            assessedAt: now,
            dueAt: dueAt(result.action, now, policy.definition.reviewHours),
            expiresAt: new Date(+now + policy.definition.retentionDays * day),
            evidence: result.evidence,
          },
          skipDuplicates: true,
        });
        created += record.count;
      } catch {
        this.logger.warn(`Referral risk assessment deferred for ${claim.id}.`);
      }
    }
    return created;
  }

  async cleanup(now = new Date()) {
    const { definition } = await this.policies.active();
    const observationWindows = definition.signals
      .filter(
        (signal) =>
          signal.enabled && (signal.code === 'SHARED_DEVICE' || signal.code === 'SHARED_NETWORK'),
      )
      .map(({ windowDays }) => windowDays);
    const observationDays = Math.min(definition.retentionDays, Math.max(0, ...observationWindows));
    await Promise.all([
      this.db.referralRiskObservation.deleteMany({
        where: { recordedAt: { lte: new Date(+now - observationDays * day) } },
      }),
      this.db.referralRiskAssessment.updateMany({
        where: { expiresAt: { lte: now }, evidence: { not: Prisma.DbNull } },
        data: { evidence: Prisma.DbNull },
      }),
    ]);
  }

  async queue(
    page: number,
    queue: 'open' | 'resolved' | 'all',
    now = new Date(),
  ): Promise<ReferralRiskQueueDto> {
    const where: Prisma.ReferralRiskAssessmentWhereInput =
      queue === 'all'
        ? {}
        : { action: queue === 'open' ? { in: [...openActions] } : { notIn: [...openActions] } };
    const rows = await this.db.referralRiskAssessment.findMany({
      where,
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { assessedAt: 'desc' },
        { attributionId: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return {
      items: rows.slice(0, pageSize).map((row) => caseDto(row, now)),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  async read(id: string, now = new Date()) {
    const row = await this.db.referralRiskAssessment.findUnique({
      where: { attributionId: id },
      include: { reviews: { orderBy: { revision: 'desc' }, take: 100 } },
    });
    if (!row) throw new NotFoundException('Referral risk case not found.');
    return caseDto(row, now, row.reviews);
  }

  async review(id: string, input: ReviewReferralRiskDto, actorUserId: string, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.referralRiskAssessment.findUnique({ where: { attributionId: id } });
      if (!row) throw new NotFoundException('Referral risk case not found.');
      if (row.revision !== input.expectedRevision)
        throw new ConflictException('The case has changed.');
      const policy = row.policySnapshot as unknown as ReferralRiskPolicyDto;
      const result = await tx.referralRiskAssessment.updateMany({
        where: { attributionId: id, revision: input.expectedRevision },
        data: {
          revision: { increment: 1 },
          action: input.action,
          dueAt: dueAt(input.action, now, policy.reviewHours),
        },
      });
      if (!result.count) throw new ConflictException('The case has changed.');
      const review = await tx.referralRiskReview.create({
        data: {
          attributionId: id,
          revision: row.revision + 1,
          fromAction: row.action,
          action: input.action,
          reason: input.reason,
          actorUserId,
          recordedAt: now,
        },
      });
      const updated = await tx.referralRiskAssessment.findUniqueOrThrow({
        where: { attributionId: id },
      });
      return attachHumanAuditEvent(caseDto(updated, now, [review]), {
        title: 'تصمیم پروندهٔ بررسی معرفی ثبت شد.',
        operationType: 'STATUS_CHANGE',
        entityName: id,
        changes: [
          { field: 'action', label: 'تصمیم', before: row.action, after: input.action },
          { field: 'reason', label: 'دلیل بررسی', before: null, after: input.reason },
        ],
      });
    });
  }
}
