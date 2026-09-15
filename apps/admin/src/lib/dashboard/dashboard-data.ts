import 'server-only';

import { cookies } from 'next/headers';

import { hasAllAdminPermissions, type AdminCurrentUser } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import {
  dashboardPeriodStart,
  parseAlerts,
  parseFinance,
  parseInventory,
  parseOperations,
  parseOrders,
  parseWorkItems,
  type DashboardAlerts,
  type DashboardFinance,
  type DashboardInventory,
  type DashboardOperations,
  type DashboardOrder,
  type DashboardPeriod,
  type DashboardWorkItem,
} from '@/lib/dashboard/dashboard-model';

export type DashboardResource<T> = Readonly<{
  data: T | null;
  failed: boolean;
}>;

export type AdminDashboardData = Readonly<{
  generatedAt: Date;
  period: DashboardPeriod;
  financeRestricted: boolean;
  finance: DashboardResource<DashboardFinance>;
  operations: DashboardResource<DashboardOperations>;
  alerts: DashboardResource<DashboardAlerts>;
  inventory: DashboardResource<DashboardInventory>;
  recentOrders: DashboardResource<readonly DashboardOrder[]>;
  priorityWork: DashboardResource<readonly DashboardWorkItem[]>;
}>;

type ApiResult = Readonly<{
  data?: unknown;
  response: Response;
}>;

async function loadResource<T>(
  request: Promise<ApiResult>,
  parse: (value: unknown) => T | null,
): Promise<DashboardResource<T>> {
  try {
    const { data, response } = await request;
    if (!response.ok) return { data: null, failed: true };

    const parsed = parse(data);
    return parsed === null ? { data: null, failed: true } : { data: parsed, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

const unavailableFinance: DashboardResource<DashboardFinance> = {
  data: null,
  failed: false,
};

export async function loadAdminDashboard(
  user: AdminCurrentUser,
  period: DashboardPeriod,
  now = new Date(),
): Promise<AdminDashboardData> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) throw new Error('Authenticated admin session is required.');

  const client = createAdminApiClient(accessToken);
  const canReadFinance = hasAllAdminPermissions(user, ['finance.read']);
  const commonOptions = { cache: 'no-store' as const };

  const financeRequest = canReadFinance
    ? loadResource(
        client.GET('/api/v1/finance/dashboard', {
          ...commonOptions,
          params: {
            query: {
              from: dashboardPeriodStart(period, now).toISOString(),
              to: now.toISOString(),
            },
          },
        }) as Promise<ApiResult>,
        parseFinance,
      )
    : Promise.resolve(unavailableFinance);

  const [finance, operations, alerts, inventory, recentOrders, priorityWork] = await Promise.all([
    financeRequest,
    loadResource(
      client.GET('/api/v1/operations/work-queue/summary', commonOptions) as Promise<ApiResult>,
      parseOperations,
    ),
    loadResource(
      client.GET('/api/v1/operations/alerts/summary', commonOptions) as Promise<ApiResult>,
      parseAlerts,
    ),
    loadResource(
      client.GET('/api/v1/inventory/stock', commonOptions) as Promise<ApiResult>,
      parseInventory,
    ),
    loadResource(
      client.GET('/api/v1/orders', {
        ...commonOptions,
        params: { query: { limit: 6 } },
      }) as Promise<ApiResult>,
      parseOrders,
    ),
    loadResource(
      client.GET('/api/v1/operations/work-queue', {
        ...commonOptions,
        params: { query: { limit: 6 } },
      }) as Promise<ApiResult>,
      parseWorkItems,
    ),
  ]);

  return {
    generatedAt: now,
    period,
    financeRestricted: !canReadFinance,
    finance,
    operations,
    alerts,
    inventory,
    recentOrders,
    priorityWork,
  };
}
