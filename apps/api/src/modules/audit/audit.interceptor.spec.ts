import { ForbiddenException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
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

  it('redacts credentials accidentally placed in auditable headers', async () => {
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditTrailInterceptor(auditService as unknown as AuditService);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/finance/refunds',
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'admin-client authorization=leaked-secret',
            'x-request-id': 'Bearer leaked-request-token',
          },
          auth: { userId: '10000000-0000-4000-8000-000000000001', roleCodes: ['MANAGER'] },
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    };

    await lastValueFrom(
      interceptor.intercept(
        context as unknown as ExecutionContext,
        { handle: () => of({ id: '1' }) } as CallHandler,
      ),
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: 'admin-client authorization=[REDACTED]',
        requestId: 'Bearer [REDACTED]',
      }),
    );
  });

  it('records denied sensitive mutations as failures without capturing the request body', async () => {
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditTrailInterceptor(auditService as unknown as AuditService);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl:
            '/api/v1/finance/supplier-settlements/10000000-0000-4000-8000-000000000001/pay',
          ip: '127.0.0.1',
          headers: {},
          body: { paymentReference: 'must-not-be-audited', token: 'must-not-be-audited' },
          auth: { userId: '20000000-0000-4000-8000-000000000001', roleCodes: ['ADMIN'] },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => throwError(() => new ForbiddenException()),
    } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'POST /finance/supplier-settlements/:id/pay',
        outcome: 'FAILURE',
        statusCode: 403,
        metadata: { roleCodes: ['ADMIN'] },
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('must-not-be-audited');
  });
});
