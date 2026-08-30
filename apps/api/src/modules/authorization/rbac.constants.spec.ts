import {
  ADMIN_PERMISSION_CODES,
  isPermissionCode,
  isRoleCode,
  PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_CODES,
  SYSTEM_ROLE_PERMISSION_CODES,
} from './rbac.constants';

describe('RBAC constants', () => {
  it('defines each permission code exactly once', () => {
    const codes = PERMISSION_DEFINITIONS.map(({ code }) => code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes)).toEqual(new Set(Object.values(PERMISSION_CODES)));
  });

  it('grants every defined permission to Manager', () => {
    expect(new Set(SYSTEM_ROLE_PERMISSION_CODES[ROLE_CODES.MANAGER])).toEqual(
      new Set(Object.values(PERMISSION_CODES)),
    );
  });

  it('keeps sensitive privileges away from Admin', () => {
    expect(ADMIN_PERMISSION_CODES).not.toContain(PERMISSION_CODES.PRICING_WRITE);
    expect(ADMIN_PERMISSION_CODES).not.toContain(PERMISSION_CODES.FINANCE_READ);
    expect(ADMIN_PERMISSION_CODES).not.toContain(PERMISSION_CODES.FINANCE_WRITE);
    expect(ADMIN_PERMISSION_CODES).not.toContain(PERMISSION_CODES.SETTINGS_WRITE);
    expect(ADMIN_PERMISSION_CODES).not.toContain(PERMISSION_CODES.ORDERS_CANCEL);
  });

  it('recognizes known role and permission codes', () => {
    expect(isRoleCode(ROLE_CODES.USER)).toBe(true);
    expect(isRoleCode('UNKNOWN')).toBe(false);
    expect(isPermissionCode(PERMISSION_CODES.CATALOG_READ)).toBe(true);
    expect(isPermissionCode('unknown.permission')).toBe(false);
  });

  it('does not grant administrative permissions to User', () => {
    expect(SYSTEM_ROLE_PERMISSION_CODES[ROLE_CODES.USER]).toEqual([]);
  });
});
