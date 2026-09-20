import { hasValidIranianIbanChecksum, normalizeIranianIban } from './iranian-iban';

describe('Iranian IBAN helpers', () => {
  it.each([
    ['IR820540102680020817909002', '820540102680020817909002'],
    ['IR82 0540 1026 8002 0817 9090 02', '820540102680020817909002'],
    ['۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲', '820540102680020817909002'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIranianIban(input)).toBe(expected);
  });

  it('validates the country checksum, not only the length', () => {
    expect(hasValidIranianIbanChecksum('820540102680020817909002')).toBe(true);
    expect(hasValidIranianIbanChecksum('820540102680020817909003')).toBe(false);
  });
});
