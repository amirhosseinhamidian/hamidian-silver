import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminDashboardView } from '@/components/dashboard/admin-dashboard-view';
import type { AdminDashboardData } from '@/lib/dashboard/dashboard-data';
import { formatAdminToman, toPersianDigits } from '@/lib/presentation/formatters';

function dashboardData(overrides: Partial<AdminDashboardData> = {}): AdminDashboardData {
  return {
    generatedAt: new Date('2026-09-07T12:00:00.000Z'),
    period: '24h',
    financeRestricted: false,
    finance: {
      failed: false,
      data: {
        paidOrderCount: 6,
        grossSalesToman: 14_000_000,
        netCollectedRevenueToman: 12_345_000,
      },
    },
    operations: {
      failed: false,
      data: {
        total: 8,
        uniqueOrderCount: 6,
        ready: 3,
        blocked: 4,
        overdue: 1,
        reconciliationRequired: 0,
        platingPending: 2,
        platingInProgress: 1,
        shipmentReady: 2,
        shipmentReadyForHandoff: 1,
      },
    },
    alerts: {
      failed: false,
      data: { activeIncidentCount: 2, critical: 1, overdue: 1, reconciliationRequired: 0 },
    },
    inventory: {
      failed: false,
      data: {
        stockRecordCount: 18,
        availableUnits: 42,
        reservedUnits: 5,
        lowStockCount: 3,
        outOfStockCount: 1,
      },
    },
    recentOrders: {
      failed: false,
      data: [
        {
          id: 'order-1',
          orderNumber: 'HS-1042',
          status: 'PROCESSING',
          grandTotalToman: 8_640_000,
          createdAt: '2026-09-07T09:00:00.000Z',
          customerName: 'سارا محمدی',
          customerPhone: '+989121234567',
          itemCount: 3,
        },
      ],
    },
    priorityWork: {
      failed: false,
      data: [
        {
          orderId: 'order-1',
          orderNumber: 'HS-1042',
          workType: 'SHIPPING',
          code: 'READY_FOR_HANDOFF',
          state: 'READY',
          priority: 'MEDIUM',
          dueAt: null,
          ageMinutes: 90,
        },
      ],
    },
    ...overrides,
  };
}

describe('AdminDashboardView', () => {
  it('renders live KPI values, priority work and responsive order details', async () => {
    render(<AdminDashboardView data={dashboardData()} />);

    expect(screen.getByRole('heading', { name: 'داشبورد مدیریتی' })).toBeInTheDocument();
    expect(screen.getByText(formatAdminToman(12_345_000))).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'توزیع صف عملیات؛ مجموع ۸' })).toBeInTheDocument();
    expect(screen.getAllByText(toPersianDigits('HS-1042')).length).toBeGreaterThan(0);
    expect(screen.getByText('آماده تحویل به ارسال‌کننده')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    expect(
      await screen.findByRole('dialog', { name: `سفارش ${toPersianDigits('HS-1042')}` }),
    ).toBeInTheDocument();
  });

  it('does not expose a finance link when the account lacks finance permission', () => {
    render(
      <AdminDashboardView
        data={dashboardData({
          financeRestricted: true,
          finance: { data: null, failed: false },
        })}
      />,
    );

    expect(screen.getAllByText('محدود')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /فروش قطعی/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /درآمد خالص دریافتی/ })).not.toBeInTheDocument();
  });

  it('keeps available sections visible when one upstream resource fails', () => {
    render(
      <AdminDashboardView
        data={dashboardData({
          alerts: { data: null, failed: true },
        })}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('۱ بخش از داشبورد');
    expect(screen.getByText(formatAdminToman(12_345_000))).toBeInTheDocument();
    expect(screen.getByText('هشدار فعال').parentElement).toHaveTextContent('—');
  });
});
