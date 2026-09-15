import { BadRequestException, ConflictException } from '@nestjs/common';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserManagementService } from './user-management.service';

const userId = '10000000-0000-4000-8000-000000000001';
const actorUserId = '20000000-0000-4000-8000-000000000001';

describe('UserManagementService', () => {
  it('prevents an operator from deactivating their own account', async () => {
    const service = new UserManagementService({} as PrismaService);

    await expect(service.updateStatus(userId, userId, { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('protects the last active manager from deactivation', async () => {
    const transaction = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          deletedAt: null,
          roles: [{ role: { code: 'MANAGER' } }],
        }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new UserManagementService(prisma as unknown as PrismaService);

    await expect(
      service.updateStatus(userId, actorUserId, { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents operators from changing their own roles', async () => {
    const service = new UserManagementService({} as PrismaService);

    await expect(
      service.updateRoles(userId, userId, { roleCodes: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes every active session of another user', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: userId, deletedAt: null }) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const service = new UserManagementService(prisma as unknown as PrismaService);

    await expect(service.revokeSessions(userId, actorUserId)).resolves.toEqual({
      userId,
      revokedSessionCount: 3,
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
