import {
  attachHumanAuditEvent,
  resolveHumanAuditEvent,
  sanitizeHumanAuditEvent,
  sanitizeAuditText,
} from './audit-event';

describe('human audit event projection', () => {
  it('keeps an attached structured event outside the serialized response', () => {
    const response = attachHumanAuditEvent(
      { id: 'product-1' },
      {
        title: 'قیمت فروش انگشتر از ۱۰۰ به ۱۲۰ تغییر کرد.',
        operationType: 'PRICE_CHANGE',
        entityName: 'انگشتر',
        changes: [{ field: 'salePriceToman', label: 'قیمت فروش', before: 100, after: 120 }],
      },
    );

    expect(JSON.stringify(response)).toBe('{"id":"product-1"}');
    expect(
      resolveHumanAuditEvent(
        response,
        { action: 'PATCH /pricing/products/:id/sale-price', resource: 'pricing', method: 'PATCH' },
        'SUCCESS',
      ),
    ).toEqual(
      expect.objectContaining({
        operationType: 'PRICE_CHANGE',
        entityName: 'انگشتر',
      }),
    );
  });

  it('drops sensitive fields and provides a Persian fallback for legacy operations', () => {
    expect(
      sanitizeHumanAuditEvent({
        title: 'ویرایش کاربر',
        operationType: 'UPDATE',
        entityName: 'کاربر',
        changes: [
          { field: 'name', label: 'نام', before: 'الف', after: 'ب' },
          { field: 'accessToken', label: 'توکن', before: 'old', after: 'new' },
        ],
      }).changes,
    ).toEqual([{ field: 'name', label: 'نام', before: 'الف', after: 'ب' }]);

    expect(
      resolveHumanAuditEvent(
        null,
        { action: 'DELETE /catalog/products/:id', resource: 'catalog', method: 'DELETE' },
        'FAILURE',
      ),
    ).toEqual({
      title: 'تلاش ناموفق برای حذف کاتالوگ',
      operationType: 'DELETE',
      entityName: 'کاتالوگ',
      changes: [],
    });
  });

  it('redacts bearer tokens, JWTs and secret assignments from every retained text value', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.signature123';
    const event = sanitizeHumanAuditEvent({
      title: `ویرایش محصول token=plain-secret ${jwt}`,
      operationType: 'UPDATE',
      entityName: 'Bearer opaque-admin-token',
      changes: [
        {
          field: 'description',
          label: 'توضیحات',
          before: 'بدون مقدار',
          after: ['متن امن', 'api_key=do-not-store'],
        },
      ],
    });

    expect(JSON.stringify(event)).not.toContain('plain-secret');
    expect(JSON.stringify(event)).not.toContain('opaque-admin-token');
    expect(JSON.stringify(event)).not.toContain(jwt);
    expect(JSON.stringify(event)).not.toContain('do-not-store');
    expect(event.title).toContain('token=[REDACTED]');
    expect(event.entityName).toBe('Bearer [REDACTED]');
    expect(event.changes[0]?.after).toEqual(['متن امن', 'api_key=[REDACTED]']);
  });

  it('bounds sanitized audit headers after redaction', () => {
    expect(sanitizeAuditText('authorization=super-secret', 500)).toBe('authorization=[REDACTED]');
    expect(sanitizeAuditText('safe-user-agent', 4)).toBe('safe');
  });
});
