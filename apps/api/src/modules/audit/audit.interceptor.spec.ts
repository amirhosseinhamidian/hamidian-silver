import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { attachHumanAuditEvent } from './audit-event';
import { AuditTrailInterceptor, describeAuditTarget } from './audit.interceptor';
import type { AuditService } from './audit.service';

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

  it('records the attached human event while returning the original response shape', async () => {
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditTrailInterceptor(auditService as unknown as AuditService);
    const response = attachHumanAuditEvent(
      { id: 'product-1' },
      {
        title: 'قیمت فروش انگشتر آذر تغییر کرد.',
        operationType: 'PRICE_CHANGE',
        entityName: 'انگشتر آذر',
        changes: [{ field: 'salePriceToman', label: 'قیمت فروش', before: 100, after: 120 }],
      },
    );
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          originalUrl: '/api/v1/pricing/products/10000000-0000-4000-8000-000000000001/sale-price',
          url: '',
          auth: {
            userId: '20000000-0000-4000-8000-000000000001',
            roleCodes: ['MANAGER'],
          },
          headers: {},
          ip: '127.0.0.1',
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of(response) } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual({
      id: 'product-1',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'قیمت فروش انگشتر آذر تغییر کرد.',
        operationType: 'PRICE_CHANGE',
        entityName: 'انگشتر آذر',
        changes: [{ field: 'salePriceToman', label: 'قیمت فروش', before: 100, after: 120 }],
        outcome: 'SUCCESS',
      }),
    );
  });
});
