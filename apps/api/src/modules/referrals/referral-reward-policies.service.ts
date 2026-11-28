import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, ReferralRewardPolicyVersion } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type {
  CreateReferralRewardDraftDto,
  ReferralPolicyDetailDto,
  ReferralPolicyListDto,
  ReferralPolicyVersionDto,
  ReferralRewardDefinitionDto,
  ReferralScopeQueryDto,
  SimulateReferralRewardPolicyDto,
} from './dto/referral-reward-policy.dto';
import {
  evaluateReferralRewards,
  ReferralRewardPolicyError,
  validateReferralRewardPolicy,
} from './referral-reward-engine';

const pageSize = 25;

export function effectiveReferralRewardPolicy(
  at: Date,
): Prisma.ReferralRewardPolicyVersionFindFirstArgs {
  return {
    where: { effectiveAt: { lte: at } },
    orderBy: [{ effectiveAt: 'desc' }, { version: 'desc' }],
  };
}

function definitionOf(row: ReferralRewardPolicyVersion) {
  return row.definition as unknown as ReferralRewardDefinitionDto;
}

function summary(row: ReferralRewardPolicyVersion): ReferralPolicyVersionDto {
  return {
    version: row.version,
    enabled: definitionOf(row).enabled,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    requestedEffectiveAt: row.requestedEffectiveAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedById: row.publishedById,
    effectiveAt: row.effectiveAt?.toISOString() ?? null,
  };
}

function detail(row: ReferralRewardPolicyVersion): ReferralPolicyDetailDto {
  return { ...summary(row), definition: definitionOf(row) };
}

function validate<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof ReferralRewardPolicyError) throw new BadRequestException(error.message);
    throw error;
  }
}

@Injectable()
export class ReferralRewardPoliciesService {
  constructor(private readonly db: PrismaService) {}

  async list(page: number): Promise<ReferralPolicyListDto> {
    const [rows, active] = await Promise.all([
      this.db.referralRewardPolicyVersion.findMany({
        orderBy: { version: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
      this.db.referralRewardPolicyVersion.findFirst(effectiveReferralRewardPolicy(new Date())),
    ]);
    return {
      items: rows.slice(0, pageSize).map(summary),
      page,
      hasMore: rows.length > pageSize,
      active: active ? detail(active) : null,
    };
  }

  async read(version: number) {
    const policy = await this.db.referralRewardPolicyVersion.findUnique({ where: { version } });
    if (!policy) throw new NotFoundException('Referral reward policy version not found.');
    return detail(policy);
  }

  scopes(query: ReferralScopeQueryDto) {
    const input = query.q?.trim();
    const ids = query.ids?.split(',');
    if ((query.q === undefined) === (ids === undefined))
      throw new BadRequestException('Provide either a search term or selected identifiers.');
    if (!input && !ids) return [];
    const name = { contains: input?.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } as const;
    const match = ids ? { id: { in: ids } } : { OR: [{ name }, { slug: name }] };
    const base = {
      take: ids ? 50 : 20,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    } as const;
    if (query.kind === 'category') {
      return this.db.category.findMany({
        ...base,
        orderBy: [...base.orderBy],
        where: { ...match, ...(ids ? {} : { isActive: true, deletedAt: null }) },
      });
    }
    return this.db.campaign.findMany({
      ...base,
      orderBy: [...base.orderBy],
      where: match,
    });
  }

  async createDraft(input: CreateReferralRewardDraftDto, actorUserId: string) {
    validate(() => validateReferralRewardPolicy(input.definition));
    const requestedEffectiveAt = input.requestedEffectiveAt
      ? new Date(input.requestedEffectiveAt)
      : null;
    const definition = JSON.parse(JSON.stringify(input.definition)) as Prisma.InputJsonObject;
    const requestId = input.requestId.toLowerCase();
    return this.db.$transaction(async (tx) => {
      const result = await tx.referralRewardPolicyVersion.createMany({
        data: { requestId, definition, createdById: actorUserId, requestedEffectiveAt },
        skipDuplicates: true,
      });
      const row = await tx.referralRewardPolicyVersion.findUniqueOrThrow({ where: { requestId } });
      if (
        row.createdById !== actorUserId ||
        row.requestedEffectiveAt?.valueOf() !== requestedEffectiveAt?.valueOf() ||
        !isDeepStrictEqual(row.definition, definition)
      )
        throw new ConflictException('The request key is already in use.');
      return attachHumanAuditEvent(detail(row), {
        title: result.count ? 'پیش‌نویس سیاست معرفی ثبت شد.' : 'پیش‌نویس سیاست معرفی بازیابی شد.',
        operationType: 'CREATE',
        entityName: String(row.version),
        changes: result.count
          ? [{ field: 'version', label: 'نسخهٔ سیاست', before: null, after: row.version }]
          : [],
      });
    });
  }

  async publish(version: number, actorUserId: string) {
    return this.db.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ version: number }>>`
        SELECT "version" FROM "referral_reward_policy_versions" WHERE "version" = ${version} FOR UPDATE
      `;
      if (!locked) throw new NotFoundException('Referral reward policy version not found.');
      const row = await tx.referralRewardPolicyVersion.findUniqueOrThrow({ where: { version } });
      if (row.publishedAt) return detail(row);
      const definition = definitionOf(row);
      await this.validateReferences(tx, definition);
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS now
      `;
      if (row.requestedEffectiveAt && row.requestedEffectiveAt < now) {
        throw new BadRequestException('زمان اثرگذاری گذشته است. پیش‌نویس تازه ذخیره کنید.');
      }
      const published = await tx.referralRewardPolicyVersion.update({
        where: { version },
        data: {
          publishedAt: now,
          publishedById: actorUserId,
          effectiveAt: row.requestedEffectiveAt ?? now,
        },
      });
      return attachHumanAuditEvent(detail(published), {
        title: 'نسخهٔ سیاست پاداش معرفی منتشر شد.',
        operationType: 'STATUS_CHANGE',
        entityName: String(version),
        changes: [
          {
            field: 'effectiveAt',
            label: 'زمان اثرگذاری',
            before: null,
            after: published.effectiveAt?.toISOString() ?? null,
          },
          { field: 'enabled', label: 'پاداش فعال', before: null, after: definition.enabled },
        ],
      });
    });
  }

  simulate(input: SimulateReferralRewardPolicyDto) {
    return validate(() => evaluateReferralRewards(input.definition, input.sample));
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    definition: ReferralRewardDefinitionDto,
  ) {
    if (!definition.enabled) return;
    const rules = definition.rules.filter(({ enabled }) => enabled);
    const categoryIds = [
      ...new Set(rules.flatMap((rule) => rule.allowedCategoryIds).map((id) => id.toLowerCase())),
    ];
    const campaignIds = [
      ...new Set(rules.flatMap((rule) => rule.campaignIds).map((id) => id.toLowerCase())),
    ];
    if (
      categoryIds.length &&
      (await tx.category.count({
        where: { id: { in: categoryIds }, isActive: true, deletedAt: null },
      })) !== categoryIds.length
    )
      throw new BadRequestException('یکی از دسته‌های انتخاب‌شده وجود ندارد یا غیرفعال است.');
    if (
      campaignIds.length &&
      (await tx.campaign.count({
        where: { id: { in: campaignIds } },
      })) !== campaignIds.length
    )
      throw new BadRequestException('یکی از کمپین‌های انتخاب‌شده وجود ندارد.');
  }
}
