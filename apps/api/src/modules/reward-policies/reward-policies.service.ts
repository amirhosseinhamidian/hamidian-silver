import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, RewardPolicyVersion } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import type {
  ActiveRewardPolicyDto,
  CreateRewardPolicyDto,
  RewardPolicyDefinitionDto,
  RewardPolicyDetailDto,
  RewardPolicyListDto,
  RewardPolicyVersionDto,
  RewardSimulationDto,
  SimulateRewardPolicyDto,
} from './dto/reward-policy.dto';
import {
  calculateRewardPolicy,
  RewardPolicyValidationError,
  validateRewardPolicy,
} from './reward-policy-engine';

const pageSize = 25;

function definitionOf(policy: RewardPolicyVersion) {
  // Only validated, immutable definitions written by this module are stored.
  return policy.definition as unknown as RewardPolicyDefinitionDto;
}

function summary(policy: RewardPolicyVersion): RewardPolicyVersionDto {
  return {
    version: policy.version,
    enabled: definitionOf(policy).enabled,
    createdAt: policy.createdAt.toISOString(),
    createdById: policy.createdById,
    requestedEffectiveAt: policy.requestedEffectiveAt?.toISOString() ?? null,
    publishedAt: policy.publishedAt?.toISOString() ?? null,
    publishedById: policy.publishedById,
    effectiveAt: policy.effectiveAt?.toISOString() ?? null,
  };
}

function detail(policy: RewardPolicyVersion): RewardPolicyDetailDto {
  return { ...summary(policy), definition: definitionOf(policy) };
}

function validate<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof RewardPolicyValidationError) throw new BadRequestException(error.message);
    throw error;
  }
}

@Injectable()
export class RewardPoliciesService {
  constructor(private readonly db: PrismaService) {}

  async list(page: number): Promise<RewardPolicyListDto> {
    const rows = await this.db.rewardPolicyVersion.findMany({
      orderBy: { version: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return { items: rows.slice(0, pageSize).map(summary), page, hasMore: rows.length > pageSize };
  }

  async read(
    version: number,
    tx: Prisma.TransactionClient = this.db,
  ): Promise<RewardPolicyDetailDto> {
    const policy = await tx.rewardPolicyVersion.findUnique({ where: { version } });
    if (!policy) throw new NotFoundException('Reward policy version not found.');
    return detail(policy);
  }

  async active(
    at = new Date(),
    tx: Prisma.TransactionClient = this.db,
  ): Promise<ActiveRewardPolicyDto> {
    const policy = await tx.rewardPolicyVersion.findFirst({
      where: { effectiveAt: { lte: at } },
      orderBy: [{ effectiveAt: 'desc' }, { version: 'desc' }],
    });
    return { policy: policy ? detail(policy) : null };
  }

  async createDraft(
    input: CreateRewardPolicyDto,
    actorUserId: string,
  ): Promise<RewardPolicyDetailDto> {
    validate(() => validateRewardPolicy(input.definition));
    const requestedEffectiveAt = input.requestedEffectiveAt
      ? new Date(input.requestedEffectiveAt)
      : null;
    if (requestedEffectiveAt && !Number.isFinite(requestedEffectiveAt.valueOf()))
      throw new BadRequestException('Enter a valid effective time.');
    const definition = JSON.parse(JSON.stringify(input.definition)) as Prisma.InputJsonObject;
    return this.db.$transaction(async (tx) => {
      const inserted = await tx.rewardPolicyVersion.createMany({
        data: {
          requestId: input.requestId,
          createdById: actorUserId,
          definition,
          requestedEffectiveAt,
        },
        skipDuplicates: true,
      });
      const policy = await tx.rewardPolicyVersion.findUniqueOrThrow({
        where: { requestId: input.requestId },
      });
      if (
        policy.createdById !== actorUserId ||
        policy.requestedEffectiveAt?.valueOf() !== requestedEffectiveAt?.valueOf() ||
        !isDeepStrictEqual(policy.definition, definition)
      )
        throw new ConflictException('This draft request was already used with different values.');
      return attachHumanAuditEvent(detail(policy), {
        title: inserted.count ? 'پیش‌نویس سیاست اعتبار ثبت شد.' : 'پیش‌نویس قبلی بازیابی شد.',
        operationType: 'CREATE',
        entityName: String(policy.version),
        changes: inserted.count
          ? [{ field: 'version', label: 'نسخهٔ سیاست', before: null, after: policy.version }]
          : [],
      });
    });
  }

  async publish(version: number, actorUserId: string): Promise<RewardPolicyDetailDto> {
    return this.db.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ version: number }>>`
        SELECT "version" FROM "reward_policy_versions" WHERE "version" = ${version} FOR UPDATE
      `;
      if (!locked) throw new NotFoundException('Reward policy version not found.');
      const policy = await tx.rewardPolicyVersion.findUniqueOrThrow({ where: { version } });
      if (policy.publishedAt) return detail(policy);
      await this.validateEligibilityReferences(tx, definitionOf(policy));
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS now
      `;
      if (policy.requestedEffectiveAt && policy.requestedEffectiveAt < now)
        throw new BadRequestException('The requested effective time has passed. Save a new draft.');
      const published = await tx.rewardPolicyVersion.update({
        where: { version },
        data: {
          publishedAt: now,
          publishedById: actorUserId,
          effectiveAt: policy.requestedEffectiveAt ?? now,
        },
      });
      return attachHumanAuditEvent(detail(published), {
        title: 'سیاست اعتبار منتشر شد.',
        operationType: 'STATUS_CHANGE',
        entityName: String(version),
        changes: [
          {
            field: 'effectiveAt',
            label: 'زمان اثر',
            before: null,
            after: published.effectiveAt?.toISOString() ?? null,
          },
          { field: 'enabled', label: 'فعال', before: null, after: definitionOf(published).enabled },
        ],
      });
    });
  }

  async simulate(version: number, input: SimulateRewardPolicyDto): Promise<RewardSimulationDto> {
    const policy = await this.read(version);
    return validate(() => calculateRewardPolicy(policy.version, policy.definition, input));
  }

  private async validateEligibilityReferences(
    db: Prisma.TransactionClient,
    definition: RewardPolicyDefinitionDto,
  ) {
    if (!definition.enabled) return;
    const scopes = [definition.grantEligibility, definition.redemptionEligibility];
    const uniqueIds = (ids: string[]) => [...new Set(ids.map((id) => id.toLowerCase()))];
    const productIds = uniqueIds(scopes.flatMap(({ excludedProductIds }) => excludedProductIds));
    const categoryIds = uniqueIds(
      scopes.flatMap(({ allowedCategoryIds, excludedCategoryIds }) => [
        ...allowedCategoryIds,
        ...excludedCategoryIds,
      ]),
    );
    const [products, categories] = await Promise.all([
      productIds.length
        ? db.product.count({ where: { id: { in: productIds }, deletedAt: null } })
        : 0,
      categoryIds.length
        ? db.category.count({ where: { id: { in: categoryIds }, deletedAt: null } })
        : 0,
    ]);
    if (products !== productIds.length || categories !== categoryIds.length)
      throw new BadRequestException(
        'Some product or category references in the policy are unavailable.',
      );
  }
}
