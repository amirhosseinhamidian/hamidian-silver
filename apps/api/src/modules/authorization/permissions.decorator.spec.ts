import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequirePermissions } from './permissions.decorator';
import { PERMISSION_CODES } from './rbac.constants';

describe('RequirePermissions', () => {
  it('stores the requested permission metadata', () => {
    class TestController {
      @RequirePermissions(PERMISSION_CODES.ORDERS_READ, PERMISSION_CODES.CATALOG_READ)
      handler(): void {}
    }

    const reflector = new Reflector();
    const permissions = reflector.get(PERMISSIONS_KEY, TestController.prototype.handler);

    expect(permissions).toEqual([PERMISSION_CODES.ORDERS_READ, PERMISSION_CODES.CATALOG_READ]);
  });
});
