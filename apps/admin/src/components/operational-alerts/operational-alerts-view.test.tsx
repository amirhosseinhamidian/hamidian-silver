import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AdminOperationalAlert,
  AdminOperationalAlertSummary,
} from '@/lib/operational-alerts/operational-alerts-model';
import { OperationalAlertsView } from './operational-alerts-view';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const alert: AdminOperationalAlert = {
  id: 'incident-1',
  incidentFingerprint: 'PLATING_OVERDUE:order-1:2026-09-07T08:00:00.000Z',
  orderId: 'order-1',
  orderNumber: 'HS-2501',
  orderStatus: 'PROCESSING',
  code: 'PLATING_OVERDUE',
  priority: 'HIGH',
  incidentAt: '2026-09-07T08:00:00.000Z',
  dueAt: '2026-09-07T08:00:00.000Z',
  firstDetectedAt: '2026-09-07T08:01:00.000Z',
  lastDetectedAt: '2026-09-08T09:00:00.000Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
  assignedTo: null,
  resolvedAt: null,
  resolutionSource: null,
  resolutionNote: null,
  workflowStatus: 'OPEN',
  snapshot: { workType: 'PLATING', state: 'OVERDUE', ageMinutes: 1_500 },
  createdAt: '2026-09-07T08:01:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
};

const summary: AdminOperationalAlertSummary = {
  generatedAt: '2026-09-08T09:00:00.000Z',
  activeIncidentCount: 1,
  critical: 0,
  overdue: 1,
  reconciliationRequired: 0,
  byCode: { PLATING_OVERDUE: 1 },
  delivery: {
    pending: 0,
    processing: 0,
    sent: 2,
    failed: 0,
    lastEnqueuedAt: '2026-09-08T08:58:00.000Z',
    lastProcessedAt: '2026-09-08T08:59:00.000Z',
  },
};

describe('OperationalAlertsView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows escalation, delivery health and responsive alert cards', () => {
    render(
      <OperationalAlertsView alerts={[alert]} summary={summary} failed={false} canAcknowledge />,
    );
    expect(screen.getByRole('img', { name: 'نمودار انواع هشدار عملیاتی' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های هشدار عملیاتی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('Escalation').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'رفع عامل هشدار' })[0]).toHaveAttribute(
      'href',
      '/plating',
    );
  });

  it('acknowledges an open alert through the admin BFF', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    render(
      <OperationalAlertsView alerts={[alert]} summary={summary} failed={false} canAcknowledge />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'تأیید دریافت' })[0]);
    const confirmationButtons = screen.getAllByRole('button', { name: 'تأیید دریافت' });
    fireEvent.click(confirmationButtons[confirmationButtons.length - 1]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/operational-alerts/incident-1/acknowledge',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
