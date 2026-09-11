import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuditLogView } from '@/components/audit-log/audit-log-view';
import type { AuditLogSnapshot } from '@/lib/audit-log/audit-log-model';

const snapshot: AuditLogSnapshot = {
  items: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      actor: {
        id: '20000000-0000-4000-8000-000000000001',
        phone: '09121234567',
        name: 'مدیر سیستم',
      },
      title: 'قیمت فروش انگشتر آذر از ۱۲۰۰۰۰۰ به ۱۳۵۰۰۰۰ تغییر کرد.',
      operationType: 'PRICE_CHANGE',
      entityName: 'انگشتر آذر',
      changes: [
        {
          field: 'salePriceToman',
          label: 'قیمت فروش',
          before: 1_200_000,
          after: 1_350_000,
        },
      ],
      action: 'PATCH /pricing/products/:id/sale-price',
      resource: 'pricing',
      resourceId: '30000000-0000-4000-8000-000000000001',
      method: 'PATCH',
      path: '/api/v1/pricing/products/30000000-0000-4000-8000-000000000001/sale-price',
      statusCode: 200,
      outcome: 'SUCCESS',
      ipAddress: null,
      userAgent: null,
      requestId: null,
      durationMs: 14,
      metadata: { roleCodes: ['MANAGER'] },
      createdAt: '2026-09-11T00:00:00.000Z',
    },
  ],
  summary: { total: 1, succeeded: 1, failed: 0, actors: 1, last24Hours: 1 },
  resources: ['pricing'],
  operationTypes: ['PRICE_CHANGE'],
  generatedAt: '2026-09-11T00:01:00.000Z',
};

describe('AuditLogView', () => {
  it('shows the Persian operation title, technical action and operation-type filter', () => {
    render(<AuditLogView snapshot={snapshot} failed={false} />);

    expect(screen.getAllByText(/قیمت فروش انگشتر آذر/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('PATCH /pricing/products/:id/sale-price').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'فیلتر نوع عملیات' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'مشاهده' })[0]!);
    const dialog = screen.getByRole('dialog', { name: /قیمت فروش انگشتر آذر/ });
    expect(within(dialog).getByText('قبل')).toBeInTheDocument();
    expect(within(dialog).getByText('بعد')).toBeInTheDocument();
    expect(within(dialog).getByText('۱٬۲۰۰٬۰۰۰')).toBeInTheDocument();
    expect(within(dialog).getByText('۱٬۳۵۰٬۰۰۰')).toBeInTheDocument();
  });
});
