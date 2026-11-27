import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import {
  growthReviewPeriods,
  readGrowthCreditCommitments,
  readGrowthReviewPeriod,
} from '../src/modules/growth-attribution/growth-review';

async function main() {
  const periods = growthReviewPeriods(process.argv.slice(2));
  const databaseUrl = process.env.QA04_REVIEW_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set QA04_REVIEW_DATABASE_URL for the authorized review copy.');
  const db = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
  try {
    const report = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
        const [window] = await tx.$queryRaw<{ closed: boolean }[]>`
        SELECT ${periods.evaluation.to}::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tehran')::date AS closed
      `;
        if (!window.closed) throw new Error('Choose a completed evaluation period.');
        const baseline = await readGrowthReviewPeriod(tx, periods.baseline);
        const evaluation = await readGrowthReviewPeriod(tx, periods.evaluation);
        const { asOf, commitment } = await readGrowthCreditCommitments(tx);
        return {
          observedAt: asOf.toISOString(),
          baseline: { ...periods.baseline, metrics: baseline },
          evaluation: { ...periods.evaluation, metrics: evaluation },
          creditCommitmentSnapshot: commitment,
          profitStatus: 'UNKNOWN',
          giftFinderMeasurementStatus: 'NOT_INSTRUMENTED',
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 35_000 },
    );
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } finally {
    await db.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Growth review could not be read. Check the authorized review database and the four dates (completed periods, baseline first, equal inclusive duration, up to 92 days).\n',
  );
  process.exitCode = 1;
});
