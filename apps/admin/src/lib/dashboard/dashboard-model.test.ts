import { describe, expect, it } from 'vitest';

import {
  dashboardPeriodStart,
  parseAlerts,
  parseDashboardPeriod,
  parseFinance,
  parseInventory,
  parseOperations,
  parseOrders,
  parseWorkItems,
} from '@/lib/dashboard/dashboard-model';

describe('dashboard model', () => {
  it('normalizes supported periods and calculates deterministic ranges', () => {
    const now = new Date('2026-09-07T12:00:00.000Z');

    expect(parseDashboardPeriod(undefined)).toBe('24h');
    expect(parseDashboardPeriod('unknown')).toBe('24h');
    expect(parseDashboardPeriod(['7d', '30d'])).toBe('7d');
    expect(dashboardPeriodStart('30d', now).toISOString()).toBe('2026-08-08T12:00:00.000Z');
  });

  it('parses finance, operations and alert summaries without trusting invalid numbers', () => {
    expect(
      parseFinance({
        paidOrderCount: 8,
        grossSalesToman: 42_000_000,
        netCollectedRevenueToman: -10,
      }),
    ).toEqual({
      paidOrderCount: 8,
      grossSalesToman: 42_000_000,
      netCollectedRevenueToman: -10,
    });

    expect(parseOperations({ total: 12, uniqueOrderCount: 9, ready: 4, overdue: 2 })).toEqual(
      expect.objectContaining({ total: 12, uniqueOrderCount: 9, ready: 4, overdue: 2 }),
    );
    expect(parseAlerts({ activeIncidentCount: 3, critical: 1 })).toEqual(
      expect.objectContaining({ activeIncidentCount: 3, critical: 1 }),
    );
    expect(parseFinance(null)).toBeNull();
  });

  it('aggregates inventory availability, reservations and stock warnings', () => {
    expect(
      parseInventory([
        { available: 4, reserved: 2, isLowStock: false },
        { available: 1, reserved: 0, isLowStock: true },
        { available: 0, reserved: 1, isLowStock: true },
        null,
      ]),
    ).toEqual({
      stockRecordCount: 3,
      availableUnits: 5,
      reservedUnits: 3,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
  });

  it('keeps only valid recent orders and operational work items', () => {
    expect(
      parseOrders([
        {
          id: 'order-1',
          orderNumber: 'HS-1042',
          status: 'PROCESSING',
          grandTotalToman: 8_640_000,
          createdAt: '2026-09-07T09:00:00.000Z',
          user: { phone: '+989121234567', firstName: 'سارا', lastName: 'محمدی' },
          items: [{}, {}, {}],
        },
        { id: 'invalid-order' },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'order-1',
        customerName: 'سارا محمدی',
        itemCount: 3,
      }),
    ]);

    expect(
      parseWorkItems({
        items: [
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
          { orderId: 'invalid-work', priority: 'UNKNOWN' },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        orderId: 'order-1',
        code: 'READY_FOR_HANDOFF',
        ageMinutes: 90,
      }),
    ]);
  });
});
