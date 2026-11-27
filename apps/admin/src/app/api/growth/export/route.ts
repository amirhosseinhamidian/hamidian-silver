import { loadGrowthExport } from '@/lib/growth/growth-data';
import { growthReportCsv, parseGrowthFilters } from '@/lib/growth/growth-report';

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const filters = parseGrowthFilters(
    Object.fromEntries(
      Array.from(params.keys(), (key) => [key, params.get(key) ?? undefined] as const),
    ),
  );
  const { data, status } = await loadGrowthExport(filters);
  const cacheControl = { 'Cache-Control': 'private, no-store' };
  if (!data) {
    return new Response(null, { status: status >= 400 ? status : 502, headers: cacheControl });
  }
  return new Response(growthReportCsv(data), {
    headers: {
      ...cacheControl,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="growth-report.csv"',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
