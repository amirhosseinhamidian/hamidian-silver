import 'reflect-metadata';
import { GoogleSearchConsoleClient } from '../src/modules/seo/search-console/google-search-console.client';
import { SearchConsoleError } from '../src/modules/seo/search-console/search-console-errors';
import { SearchConsoleService } from '../src/modules/seo/search-console/search-console.service';

async function main() {
  const [startDate, endDate] = process.argv.slice(2);
  if (!startDate || !endDate) {
    process.stderr.write('Provide a start and end date in YYYY-MM-DD format.\n');
    process.exitCode = 1;
    return;
  }
  const service = new SearchConsoleService(
    new GoogleSearchConsoleClient({
      property: process.env.SEARCH_CONSOLE_PROPERTY,
      credentialsFile: process.env.SEARCH_CONSOLE_CREDENTIALS_FILE,
    }),
  );
  const connection = await service.connection();
  if (connection.status !== 'connected') {
    process.stderr.write(`${connection.reason}: ${connection.message}\n`);
    process.exitCode = 1;
    return;
  }
  const performance = await service.performance({ startDate, endDate, rowLimit: 1 });
  const sitemaps = await service.sitemaps();
  process.stdout.write(
    `${JSON.stringify({
      property: connection.property,
      status: connection.status,
      performanceRows: performance.rows.length,
      aggregation: performance.aggregation,
      sitemapCount: sitemaps.items.length,
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof SearchConsoleError
      ? `${error.code}: ${error.message}`
      : 'Search Console smoke check failed. Check the requested dates and local configuration.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
