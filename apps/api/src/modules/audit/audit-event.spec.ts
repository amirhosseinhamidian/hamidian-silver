import {
  attachHumanAuditEvent,
  resolveHumanAuditEvent,
  sanitizeHumanAuditEvent,
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
});
