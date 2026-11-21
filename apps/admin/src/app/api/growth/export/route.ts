import { loadGrowthExport } from '@/lib/growth/growth-data';
import { growthReportCsv, parseGrowthFilters } from '@/lib/growth/growth-report';

export async function GET(request: Request): Promise<Response> {
  const filters = parseGrowthFilters(Object.fromEntries(new URL(request.url).searchParams));
  const { data, status } = await loadGrowthExport(filters);
  if (!data) return new Response(null, { status: status >= 400 ? status : 502 });
  return new Response(growthReportCsv(data), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="growth-report.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
