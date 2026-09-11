import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { resolveHumanAuditEvent } from '../audit/audit-event';
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

  it('describes removed permissions without exposing the audit marker in the response', async () => {
    const transaction = {
      role: {
        findFirst: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001',
          name: 'مدیر عملیاتی',
          permissions: [
            { permission: { code: 'catalog.read' } },
            { permission: { code: 'catalog.write' } },
          ],
        }),
      },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: '20000000-0000-4000-8000-000000000001', code: 'catalog.read' },
          ]),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
      role: { findMany: jest.fn().mockResolvedValue([]) },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new UserManagementService(prisma as unknown as PrismaService);

    const result = await service.updateRolePermissions(
      'ADMIN',
      { permissionCodes: ['catalog.read'] },
      ['MANAGER'],
    );

    expect(
      resolveHumanAuditEvent(
        result,
        {
          action: 'PUT /admin-roles/ADMIN/permissions',
          resource: 'admin-roles',
          method: 'PUT',
        },
        'SUCCESS',
      ),
    ).toEqual(
      expect.objectContaining({
        title: 'دسترسی catalog.write از نقش مدیر عملیاتی حذف شد.',
        operationType: 'PERMISSION_CHANGE',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('human-audit-event');
  });
});
