import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

async function main() {
  const days = Number(process.argv[2] ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('Choose a report period between 1 and 90 days.');
  }
  const prisma = new PrismaService(new ConfigService());
  try {
    const summary = await prisma.$queryRaw<
      { term: string; searches: string; withoutResult: string }[]
    >`
      SELECT "term", SUM("searches")::text AS "searches",
        SUM("withoutResult")::text AS "withoutResult"
      FROM "catalog_search_daily"
      WHERE "day" >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - ${days - 1}::integer
      GROUP BY "term"
      ORDER BY SUM("searches") DESC, SUM("withoutResult") DESC, "term" ASC
      LIMIT 100
    `;
    process.stdout.write(`${JSON.stringify({ days, summary }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Could not read the aggregate catalog search report. Check the database, migration and period.\n',
  );
  process.exitCode = 1;
});
