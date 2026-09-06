import { describe, expect, it } from 'vitest';

import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from './formatters';

describe('admin presentation formatters', () => {
  it('normalizes and presents Persian digits', () => {
    expect(toAsciiDigits('۱۲٣۴۵')).toBe('12345');
    expect(toPersianDigits('Order 123')).toBe('Order ۱۲۳');
    expect(formatAdminInteger(1_250_000)).toBe('۱٬۲۵۰٬۰۰۰');
    expect(formatAdminToman(125_000)).toBe('۱۲۵٬۰۰۰ تومان');
    expect(formatAdminPhone('+989121234567')).toBe('۰۹۱۲۱۲۳۴۵۶۷');
  });

  it('uses an explicit fallback for invalid dates', () => {
    expect(formatAdminDateTime('invalid')).toBe('—');
  });
});
