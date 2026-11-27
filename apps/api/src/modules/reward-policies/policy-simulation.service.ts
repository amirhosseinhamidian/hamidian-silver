import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import type { PolicySimulationReview, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReferralRewardPolicyError } from '../referrals/referral-reward-engine';
import type {
  PolicyBasketResultDto,
  PolicyBasketScenarioDto,
  PolicyHistoryResultDto,
  PolicyHistoryScenarioDto,
  PolicyReviewDto,
} from './dto/policy-simulation.dto';
import { evaluatePolicyBasket } from './policy-simulation-basket';
import { replayPurchaseRewards } from './policy-simulation-history';
import { RewardPolicyValidationError } from './reward-policy-engine';
import { RewardPoliciesService } from './reward-policies.service';

type Scenario = PolicyBasketScenarioDto | PolicyHistoryScenarioDto;
type SimulationResult = PolicyBasketResultDto | PolicyHistoryResultDto;
const pageSize = 20;

function jsonSnapshot(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function verifyReview(
  record: PolicySimulationReview,
  expected: Pick<PolicySimulationReview, 'mode' | 'decision' | 'actorUserId'> & { input: object },
) {
  if (
    record.actorUserId !== expected.actorUserId ||
    record.mode !== expected.mode ||
    record.decision !== expected.decision ||
    !isDeepStrictEqual(record.input, expected.input)
  )
    throw new ConflictException('این شناسه برای یک بررسی دیگر ثبت شده است.');
}

@Injectable()
export class PolicySimulationService {
  constructor(
    private readonly db: PrismaService,
    private readonly policies: RewardPoliciesService,
  ) {}

  basket(input: PolicyBasketScenarioDto, actorUserId: string) {
    return this.run<PolicyBasketResultDto>('BASKET', input, actorUserId, (tx) =>
      this.policies
        .read(input.version, tx)
        .then((policy) => evaluatePolicyBasket(tx, policy, input)),
    );
  }

  history(input: PolicyHistoryScenarioDto, actorUserId: string) {
    return this.run<PolicyHistoryResultDto>('HISTORY', input, actorUserId, (tx) =>
      this.policies
        .read(input.version, tx)
        .then((policy) => replayPurchaseRewards(tx, policy, input)),
    );
  }

  async list(page: number) {
    const rows = await this.db.policySimulationReview.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return {
      items: rows
        .slice(0, pageSize)
        .map(({ id, mode, decision, createdAt, actorUserId, input, result }): PolicyReviewDto => ({
          id,
          mode: mode as PolicyReviewDto['mode'],
          decision: decision as PolicyReviewDto['decision'],
          actorUserId,
          createdAt: createdAt.toISOString(),
          input: input as Record<string, unknown>,
          result: result as Record<string, unknown>,
        })),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  private async run<T extends SimulationResult>(
    mode: PolicyReviewDto['mode'],
    scenario: Scenario,
    actorUserId: string,
    evaluate: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const { review, ...input } = scenario;
    const requestId = review?.requestId.toLowerCase();
    const expected = review && {
      mode,
      decision: review.decision,
      actorUserId,
      input: jsonSnapshot(input),
    };
    if (requestId && expected) {
      const existing = await this.db.policySimulationReview.findUnique({
        where: { id: requestId },
      });
      if (existing) {
        verifyReview(existing, expected);
        return { ...(existing.result as unknown as T), reviewId: existing.id };
      }
    }
    let result: T;
    try {
      result = await this.db.$transaction(evaluate, {
        isolationLevel: 'RepeatableRead',
        timeout: 10_000,
      });
    } catch (error) {
      if (
        error instanceof RewardPolicyValidationError ||
        error instanceof ReferralRewardPolicyError
      )
        throw new BadRequestException(error.message);
      throw error;
    }
    if (!requestId || !expected) return result;

    await this.db.policySimulationReview.createMany({
      data: [
        { id: requestId, ...expected, result: jsonSnapshot({ ...result, reviewId: requestId }) },
      ],
      skipDuplicates: true,
    });
    const saved = await this.db.policySimulationReview.findUniqueOrThrow({
      where: { id: requestId },
    });
    verifyReview(saved, expected);
    return { ...(saved.result as unknown as T), reviewId: saved.id };
  }
}
