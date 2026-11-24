import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, ReferralRiskPolicyVersion } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type {
  PublishReferralRiskPolicyDto,
  ReferralRiskPolicyDto,
  ReferralRiskPolicyOverviewDto,
  SimulateReferralRiskDto,
} from './dto/referral-risk.dto';
import { assessReferralRisk, defaultReferralRiskPolicy } from './referral-risk-engine';

const pageSize = 10;
const day = 86_400_000;
const similarityCodes = new Set(['SHARED_ADDRESS', 'SHARED_RECIPIENT']);

function validatePolicy(policy: ReferralRiskPolicyDto) {
  if (policy.reviewAt >= policy.holdAt || policy.holdAt >= policy.rejectAt) {
    throw new BadRequestException('آستانهٔ بررسی، تعلیق و رد باید به‌ترتیب افزایشی باشد.');
  }
  if (
    policy.signals.some(
      ({ code, threshold }) =>
        (code === 'SELF_REFERRAL' && threshold !== 1) ||
        (similarityCodes.has(code) && threshold > 100),
    )
  ) {
    throw new BadRequestException(
      'آستانهٔ معرفی خود یک است و آستانهٔ شباهت باید بین ۱ و ۱۰۰ باشد.',
    );
  }
}

function record(version: ReferralRiskPolicyVersion | null) {
  return {
    version: version?.version ?? null,
    publishedAt: version?.publishedAt.toISOString() ?? null,
    publishedById: version?.publishedById ?? null,
    definition: version
      ? (version.definition as unknown as ReferralRiskPolicyDto)
      : defaultReferralRiskPolicy(),
  };
}

@Injectable()
export class ReferralRiskPoliciesService {
  constructor(private readonly db: PrismaService) {}

  async active() {
    return record(
      await this.db.referralRiskPolicyVersion.findFirst({ orderBy: { version: 'desc' } }),
    );
  }

  async history(page: number): Promise<ReferralRiskPolicyOverviewDto> {
    const [active, rows] = await Promise.all([
      this.active(),
      this.db.referralRiskPolicyVersion.findMany({
        orderBy: { version: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);
    return {
      active,
      history: rows.slice(0, pageSize).map(record),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  async publish(input: PublishReferralRiskPolicyDto, actorUserId: string) {
    const policy = input.definition;
    validatePolicy(policy);
    const definition = JSON.parse(JSON.stringify(policy)) as Prisma.InputJsonObject;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('referral-risk-policy-publication', 0))`;
      const requestId = input.requestId.toLowerCase();
      const existing = await tx.referralRiskPolicyVersion.findUnique({ where: { requestId } });
      if (existing) {
        if (
          existing.publishedById !== actorUserId ||
          !isDeepStrictEqual(existing.definition, definition)
        ) {
          throw new ConflictException('The request key is already in use.');
        }
        return record(existing);
      }
      const prior = await tx.referralRiskPolicyVersion.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      if ((prior?.version ?? null) !== input.expectedVersion) {
        throw new ConflictException('The active referral risk policy has changed.');
      }
      const now = Date.now();
      if (
        policy.exceptions.some(({ until }) => {
          const expires = Date.parse(until);
          return !Number.isFinite(expires) || expires > now + 90 * day;
        })
      )
        throw new BadRequestException('پایان استثنا باید حداکثر ۹۰ روز پس از اکنون باشد.');
      const attributionIds = policy.exceptions.map(({ attributionId }) =>
        attributionId.toLowerCase(),
      );
      if (
        attributionIds.length &&
        (await tx.referralAttribution.count({
          where: { id: { in: attributionIds } },
        })) !== attributionIds.length
      )
        throw new BadRequestException('شناسهٔ یکی از معرفی‌ها معتبر نیست.');
      const version = await tx.referralRiskPolicyVersion.create({
        data: { requestId, definition, publishedById: actorUserId },
      });
      return attachHumanAuditEvent(record(version), {
        title: 'نسخهٔ سیاست بررسی ریسک معرفی منتشر شد.',
        operationType: 'STATUS_CHANGE',
        entityName: String(version.version),
        changes: [
          {
            field: 'version',
            label: 'نسخهٔ سیاست',
            before: prior?.version ?? null,
            after: version.version,
          },
        ],
      });
    });
  }

  simulate(input: SimulateReferralRiskDto) {
    validatePolicy(input.definition);
    if (
      input.metrics.some(
        ({ code, value }) =>
          (code === 'SELF_REFERRAL' && value > 1) || (similarityCodes.has(code) && value > 100),
      )
    ) {
      throw new BadRequestException(
        'برای معرفی خود صفر یا یک و برای شباهت عددی بین صفر تا ۱۰۰ وارد کنید.',
      );
    }
    const metrics = Object.fromEntries(input.metrics.map(({ code, value }) => [code, value]));
    return assessReferralRisk(input.definition, metrics, input.attributionId ?? '', new Date());
  }
}
