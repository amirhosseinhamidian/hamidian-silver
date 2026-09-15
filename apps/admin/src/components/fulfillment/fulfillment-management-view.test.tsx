import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  AdminFulfillmentQueue,
  AdminFulfillmentSummary,
} from '@/lib/fulfillment/fulfillment-model';
import { FulfillmentManagementView } from './fulfillment-management-view';

const queue: AdminFulfillmentQueue = {
  generatedAt: '2026-09-08T08:00:00.000Z',
  type: null,
  state: null,
  totalMatched: 2,
  count: 2,
  items: [
    {
      orderId: 'order-1',
      orderNumber: 'HS-2401',
      orderStatus: 'PROCESSING',
      workType: 'SHIPPING',
      code: 'READY_FOR_HANDOFF',
      state: 'READY',
      priority: 'MEDIUM',
      dueAt: null,
      overdue: false,
      ageMinutes: 180,
      context: {
        phase: null,
        maxLeadTimeDays: null,
        provider: 'manual',
        providerCreationState: 'CREATED',
        providerShipmentId: 'manual:order-1',
        providerCreateError: null,
        reason: null,
        incidentAt: null,
      },
    },
    {
      orderId: 'order-2',
      orderNumber: 'HS-2402',
      orderStatus: 'PAID',
      workType: 'PLATING',
      code: 'PLATING_OVERDUE',
      state: 'OVERDUE',
      priority: 'HIGH',
      dueAt: '2026-09-07T08:00:00.000Z',
      overdue: true,
      ageMinutes: 1_500,
      context: {
        phase: 'IN_PROGRESS',
        maxLeadTimeDays: 3,
        provider: null,
        providerCreationState: null,
        providerShipmentId: null,
        providerCreateError: null,
        reason: null,
        incidentAt: null,
      },
    },
  ],
};

const summary: AdminFulfillmentSummary = {
  generatedAt: '2026-09-08T08:00:00.000Z',
  total: 2,
  uniqueOrderCount: 2,
  ready: 1,
  blocked: 0,
  overdue: 1,
  reconciliationRequired: 0,
  platingPending: 0,
  platingInProgress: 0,
  platingOverdue: 1,
  platingCancelled: 0,
  shippingNotSelected: 0,
  shipmentReady: 0,
  shipmentInProgress: 0,
  shipmentStale: 0,
  shipmentReadyForHandoff: 1,
};

describe('FulfillmentManagementView', () => {
  it('renders operational charts and responsive work queue', () => {
    render(<FulfillmentManagementView queue={queue} summary={summary} failed={false} />);
    expect(screen.getByRole('img', { name: 'نمودار وضعیت صف آماده‌سازی' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های صف آماده‌سازی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('آماده تحویل به پست').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'اقدام' })[0]).toHaveAttribute('href', '/shipping');
  });

  it('filters queue rows with localized order digits', () => {
    render(<FulfillmentManagementView queue={queue} summary={summary} failed={false} />);
    fireEvent.change(screen.getByLabelText('جستجوی صف آماده‌سازی'), {
      target: { value: '۲۴۰۲' },
    });
    expect(screen.getAllByText('آبکاری از SLA عبور کرده').length).toBeGreaterThan(0);
    expect(screen.queryByText('آماده تحویل به پست')).not.toBeInTheDocument();
  });
});
