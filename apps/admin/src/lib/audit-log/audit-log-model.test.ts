import { describe, expect, it } from 'vitest';
import { parseAuditLogSnapshot } from './audit-log-model';

describe('audit log model', () => {
  it('accepts the safe API projection', () => {
    const snapshot = parseAuditLogSnapshot({
      items: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          actor: {
            id: '20000000-0000-4000-8000-000000000001',
            phone: '09121234567',
            name: 'مدیر سیستم',
          },
          title: 'سفارش شماره HS-100 به مرحله آماده‌سازی منتقل شد.',
          operationType: 'STATUS_CHANGE',
          entityName: 'HS-100',
          changes: [
            {
              field: 'status',
              label: 'وضعیت سفارش',
              before: 'PAID',
              after: 'PROCESSING',
            },
          ],
          action: 'PATCH /orders/:id/status',
          resource: 'orders',
          resourceId: '30000000-0000-4000-8000-000000000001',
          method: 'PATCH',
          path: '/api/v1/orders/30000000-0000-4000-8000-000000000001/status',
          statusCode: 200,
          outcome: 'SUCCESS',
          ipAddress: null,
          userAgent: null,
          requestId: null,
          durationMs: 18,
          metadata: { roleCodes: ['MANAGER'] },
          createdAt: '2026-09-09T09:00:00.000Z',
        },
      ],
      summary: { total: 1, succeeded: 1, failed: 0, actors: 1, last24Hours: 1 },
      resources: ['orders'],
      operationTypes: ['STATUS_CHANGE'],
      generatedAt: '2026-09-09T09:01:00.000Z',
    });

    expect(snapshot?.items[0]?.action).toBe('PATCH /orders/:id/status');
    expect(snapshot?.items[0]?.title).toContain('آماده‌سازی');
    expect(snapshot?.items[0]?.changes[0]).toEqual(
      expect.objectContaining({ before: 'PAID', after: 'PROCESSING' }),
    );
    expect(snapshot?.summary.failed).toBe(0);
  });

  it('rejects an unknown outcome', () => {
    expect(
      parseAuditLogSnapshot({
        items: [{ outcome: 'PENDING' }],
        summary: { total: 1, succeeded: 0, failed: 0, actors: 0, last24Hours: 0 },
        resources: [],
        operationTypes: [],
        generatedAt: '2026-09-09T09:01:00.000Z',
      }),
    ).toBeNull();
  });
});
