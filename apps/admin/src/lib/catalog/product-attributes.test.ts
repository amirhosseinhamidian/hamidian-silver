import { describe, expect, it } from 'vitest';

import {
  normalizeProductAttributeKey,
  parseProductAttributesText,
} from '@/lib/catalog/product-attributes';

describe('product attribute quick input', () => {
  it('parses each non-empty line at the first colon', () => {
    expect(
      parseProductAttributesText('جنس نقره: نقره ۹۲۵\n\nنحوه نگهداری： دور از رطوبت: داخل جعبه'),
    ).toEqual({
      ok: true,
      attributes: [
        { key: 'جنس نقره', value: 'نقره ۹۲۵' },
        { key: 'نحوه نگهداری', value: 'دور از رطوبت: داخل جعبه' },
      ],
    });
  });

  it('rejects incomplete and duplicate lines before creating rows', () => {
    expect(parseProductAttributesText('جنس نقره')).toMatchObject({
      ok: false,
      message: expect.stringContaining('خط ۱'),
    });
    expect(parseProductAttributesText('نوع آبکاری: رودیوم\n نوع   آبکاری : طلا')).toEqual({
      ok: false,
      message: 'کلید «نوع   آبکاری» در متن ورودی تکرار شده است.',
    });
  });

  it('normalizes whitespace and letter case for duplicate comparison', () => {
    expect(normalizeProductAttributeKey('  Metal   TYPE ')).toBe('metal type');
  });
});
