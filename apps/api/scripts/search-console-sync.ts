import 'reflect-metadata';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { GoogleSearchConsoleClient } from '../src/modules/seo/search-console/google-search-console.client';
import { SearchConsoleError } from '../src/modules/seo/search-console/search-console-errors';
import { dayLabel } from '../src/modules/seo/search-console/search-console-sync-data';
import { SearchConsoleSyncStore } from '../src/modules/seo/search-console/search-console-sync.store';
import { SearchConsoleService } from '../src/modules/seo/search-console/search-console.service';

function parseDay(input: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(input)) return null;
  const day = new Date(`${input}T00:00:00.000Z`);
  return Number.isFinite(day.getTime()) && dayLabel(day) === input ? day : null;
}

async function main() {
  const [mode, fromInput, toInput, extra] = process.argv.slice(2);
  const from = fromInput ? parseDay(fromInput) : null;
  const to = toInput ? parseDay(toInput) : null;
  if (
    extra ||
    (mode !== 'status' && mode !== 'compare') ||
    (mode === 'status' &&
      (fromInput || toInput) &&
      (!from || !to || to.getTime() - from.getTime() > 92 * 86_400_000 || to < from)) ||
    (mode === 'compare' && (!from || toInput))
  ) {
    process.stderr.write(
      'Usage: search-console-sync.ts status [YYYY-MM-DD YYYY-MM-DD] | compare YYYY-MM-DD\n',
    );
    process.exitCode = 1;
    return;
  }

  const client = new GoogleSearchConsoleClient({
    property: process.env.SEARCH_CONSOLE_PROPERTY,
    credentialsFile: process.env.SEARCH_CONSOLE_CREDENTIALS_FILE,
  });
  if (!client.property) throw new SearchConsoleError('property_not_found');
  const prisma = new PrismaService(new ConfigService());
  try {
    if (mode === 'status') {
      const store = new SearchConsoleSyncStore(prisma);
      const status = await store.status(client.property, from ?? undefined, to ?? undefined);
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      return;
    }

    const day = from as Date;
    const saved = await prisma.seoPerformanceDaily.findFirst({
      where: {
        integration: { property: client.property },
        metricDate: day,
        searchType: 'web',
        scope: 'PROPERTY',
      },
      select: { clicks: true, impressions: true, averagePosition: true },
    });
    if (!saved) {
      process.stderr.write(
        'No stored Web property metrics for that date. Check the sync status.\n',
      );
      process.exitCode = 1;
      return;
    }
    const date = dayLabel(day);
    const response = await new SearchConsoleService(client).performance({
      startDate: date,
      endDate: date,
      searchType: 'web',
      dimensions: [],
      aggregation: 'byProperty',
      rowLimit: 1,
    });
    const [live] = response.rows;
    const matches =
      response.aggregation === 'byProperty' &&
      !!live &&
      live.clicks === saved.clicks &&
      live.impressions === saved.impressions &&
      (live.averagePosition === saved.averagePosition ||
        (live.averagePosition !== null &&
          saved.averagePosition !== null &&
          Math.abs(live.averagePosition - saved.averagePosition) <= 1e-9));
    process.stdout.write(`${JSON.stringify({ property: client.property, date, matches })}\n`);
    if (!matches) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof SearchConsoleError
      ? `${error.code}: ${error.message}`
      : 'Search Console sync inspection failed. Check the database connection and migration.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
