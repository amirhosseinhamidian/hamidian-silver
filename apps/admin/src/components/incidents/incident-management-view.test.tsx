import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOperationalAlert } from '@/lib/operational-alerts/operational-alerts-model';
import { IncidentManagementView } from './incident-management-view';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const incident: AdminOperationalAlert = {
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
  snapshot: { workType: 'PLATING', state: 'OVERDUE', ageMinutes: 1500 },
  createdAt: '2026-09-07T08:01:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
};

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ...incident,
    order: { id: 'order-1', orderNumber: incident.orderNumber, status: incident.orderStatus },
    activities: [
      {
        id: 'activity-1',
        type: 'DETECTED',
        actor: null,
        note: null,
        metadata: {},
        createdAt: incident.createdAt,
      },
    ],
    ...overrides,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('IncidentManagementView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows operational KPIs, chart and compact mobile cards', () => {
    render(
      <IncidentManagementView
        incidents={[incident]}
        failed={false}
        currentUserId="admin-1"
        canManage
      />,
    );
    expect(screen.getByRole('img', { name: /ترکیب وضعیت رخدادها/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های رخداد عملیاتی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('تأخیر در آبکاری').length).toBeGreaterThan(0);
  });

  it('loads the incident timeline and assigns it to the current manager', async () => {
    const assigned = {
      id: 'admin-1',
      phone: '09121234567',
      firstName: 'مدیر',
      lastName: 'شیفت',
    };
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(detail()))
      .mockResolvedValueOnce(
        jsonResponse(
          detail({
            assignedTo: assigned,
            activities: [
              ...detail().activities,
              {
                id: 'activity-2',
                type: 'ASSIGNED',
                actor: assigned,
                note: null,
                metadata: { assignedToUserId: 'admin-1' },
                createdAt: '2026-09-08T09:05:00.000Z',
              },
            ],
          }),
        ),
      );
    render(
      <IncidentManagementView
        incidents={[incident]}
        failed={false}
        currentUserId="admin-1"
        canManage
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات و پیگیری' }));
    expect(await screen.findByRole('list', { name: 'تاریخچه رخداد' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'اختصاص به من' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/operational-incidents/incident-1/assign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'admin-1' }),
      }),
    );
    expect(await screen.findByText('رخداد به شما اختصاص یافت.')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('keeps workflow mutations hidden for read-only users', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(detail()));
    render(
      <IncidentManagementView
        incidents={[incident]}
        failed={false}
        currentUserId="admin-1"
        canManage={false}
      />,
    );
    expect(
      screen.getByText('دسترسی شما فقط برای مشاهده رخدادها و timeline است.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات و پیگیری' }));
    await screen.findByRole('list', { name: 'تاریخچه رخداد' });
    expect(screen.queryByRole('button', { name: 'اختصاص به من' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/یادداشت/)).not.toBeInTheDocument();
  });
});
