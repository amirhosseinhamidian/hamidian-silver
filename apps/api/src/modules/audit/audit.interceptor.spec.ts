import { describeAuditTarget } from './audit.interceptor';

describe('Audit trail target projection', () => {
  it('normalizes identifiers without retaining query strings', () => {
    expect(
      describeAuditTarget(
        '/api/v1/orders/10000000-0000-4000-8000-000000000001/status?secret=value',
        'patch',
      ),
    ).toEqual({
      action: 'PATCH /orders/:id/status',
      resource: 'orders',
      resourceId: '10000000-0000-4000-8000-000000000001',
      path: '/api/v1/orders/10000000-0000-4000-8000-000000000001/status',
    });
  });
});
