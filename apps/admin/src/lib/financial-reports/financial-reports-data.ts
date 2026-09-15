import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  financialReportRange,
  parseFinanceCashflowReport,
  parseFinanceContributionReport,
  parseFinanceCostReconciliationReport,
  parseFinanceManagementReport,
  parseFinanceSuppliersReport,
  type FinanceCashflowReport,
  type FinanceContributionReport,
  type FinanceCostReconciliationReport,
  type FinanceManagementReport,
  type FinanceSupplierRow,
  type FinancialReportPeriod,
  type FinancialReportRange,
} from '@/lib/financial-reports/financial-reports-model';

export type FinancialReportResource<T> = Readonly<{
  data: T | null;
  failed: boolean;
}>;

export type AdminFinancialReportsData = Readonly<{
  generatedAt: Date;
  range: FinancialReportRange;
  management: FinancialReportResource<FinanceManagementReport>;
  cashflow: FinancialReportResource<FinanceCashflowReport>;
  contribution: FinancialReportResource<FinanceContributionReport>;
  suppliers: FinancialReportResource<readonly FinanceSupplierRow[]>;
  reconciliation: FinancialReportResource<FinanceCostReconciliationReport>;
}>;

function reportPath(path: string, range: FinancialReportRange, extras?: Record<string, string>) {
  const query = new URLSearchParams(extras);
  if (range.from) query.set('from', range.from);
  if (range.to) query.set('to', range.to);
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function loadResource<T>(
  path: string,
  token: string,
  parse: (value: unknown) => T | null,
): Promise<FinancialReportResource<T>> {
  try {
    const response = await requestAdminCatalog(path, token);
    if (!response.ok) return { data: null, failed: true };
    const data = parse(await readJsonResponse(response));
    return data === null ? { data: null, failed: true } : { data, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

export async function loadAdminFinancialReports(
  period: FinancialReportPeriod,
  now = new Date(),
): Promise<AdminFinancialReportsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  const range = financialReportRange(period, now);
  const [management, cashflow, contribution, suppliers, reconciliation] = await Promise.all([
    loadResource(
      reportPath('/api/v1/finance/dashboard/management', range),
      token,
      parseFinanceManagementReport,
    ),
    loadResource(reportPath('/api/v1/finance/cashflow', range), token, parseFinanceCashflowReport),
    loadResource(
      reportPath('/api/v1/finance/dashboard/contribution', range),
      token,
      parseFinanceContributionReport,
    ),
    loadResource(
      reportPath('/api/v1/finance/dashboard/suppliers', range),
      token,
      parseFinanceSuppliersReport,
    ),
    loadResource(
      reportPath('/api/v1/finance/cost-reconciliation', range, { limit: '100' }),
      token,
      parseFinanceCostReconciliationReport,
    ),
  ]);

  return {
    generatedAt: now,
    range,
    management,
    cashflow,
    contribution,
    suppliers,
    reconciliation,
  };
}
