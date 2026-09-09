import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserManagementService } from './user-management.service';

describe('Admin role management', () => {
  it('requires a manager role even when the permission guard has allowed the request', async () => {
    const service = new UserManagementService({} as PrismaService);

    await expect(
      service.updateRolePermissions('ADMIN', { permissionCodes: ['catalog.read'] }, ['ADMIN']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps system baseline roles immutable', async () => {
    const service = new UserManagementService({} as PrismaService);

    await expect(
      service.updateRolePermissions('MANAGER', { permissionCodes: ['catalog.read'] }, ['MANAGER']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the matching read permission for every write permission', async () => {
    const service = new UserManagementService({} as PrismaService);

    await expect(
      service.updateRolePermissions('ADMIN', { permissionCodes: ['finance.write'] }, ['MANAGER']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
