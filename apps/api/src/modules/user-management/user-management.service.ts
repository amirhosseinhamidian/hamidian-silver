import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  isPermissionCode,
  isRoleCode,
  ROLE_CODES,
  type PermissionCode,
  type RoleCode,
} from '../authorization/rbac.constants';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateAdminUserRolesDto } from './dto/update-admin-user-roles.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';

const roleInclude = {
  role: {
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  },
} as const;

const userInclude = {
  roles: { include: roleInclude, orderBy: { assignedAt: 'asc' as const } },
  sessions: {
    where: { revokedAt: null },
    select: { id: true, expiresAt: true },
  },
} as const;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminUsersQueryDto) {
    const needle = query.search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive:
          query.status === 'ACTIVE' ? true : query.status === 'INACTIVE' ? false : undefined,
        roles: query.role
          ? { some: { role: { code: query.role, isActive: true, deletedAt: null } } }
          : undefined,
        OR: needle
          ? [
              { phone: { contains: needle } },
              { firstName: { contains: needle, mode: 'insensitive' } },
              { lastName: { contains: needle, mode: 'insensitive' } },
            ]
          : undefined,
      },
      take: query.limit ?? 200,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: userInclude,
    });

    const roles = await this.prisma.role.findMany({
      where: { code: { in: Object.values(ROLE_CODES) }, isActive: true, deletedAt: null },
      orderBy: { code: 'asc' },
      include: roleInclude.role.include,
    });

    return {
      users: users.map((user) => this.projectUser(user)),
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description,
        permissions: role.permissions
          .filter(({ permission }) => isPermissionCode(permission.code))
          .map(({ permission }) => ({
            code: permission.code,
            name: permission.name,
            description: permission.description,
          })),
      })),
    };
  }

  async updateStatus(userId: string, actorUserId: string, dto: UpdateAdminUserStatusDto) {
    if (userId === actorUserId && !dto.isActive) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    await this.prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: userId },
          include: { roles: { include: { role: true } } },
        });
        if (!target || target.deletedAt) throw new NotFoundException('User was not found.');
        if (!dto.isActive && this.hasManagerRole(target.roles.map(({ role }) => role.code))) {
          await this.ensureAnotherActiveManager(transaction, userId);
        }
        await transaction.user.update({ where: { id: userId }, data: { isActive: dto.isActive } });
        if (!dto.isActive) {
          await transaction.authSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );

    return this.requireUser(userId);
  }

  async updateRoles(userId: string, actorUserId: string, dto: UpdateAdminUserRolesDto) {
    if (userId === actorUserId) {
      throw new BadRequestException('You cannot change your own roles.');
    }

    await this.prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id: userId },
          include: { roles: { include: { role: true } } },
        });
        if (!target || target.deletedAt) throw new NotFoundException('User was not found.');

        const roles = await transaction.role.findMany({
          where: {
            code: { in: dto.roleCodes },
            isSystem: true,
            isActive: true,
            deletedAt: null,
          },
        });
        if (roles.length !== dto.roleCodes.length) {
          throw new BadRequestException('One or more requested system roles are unavailable.');
        }

        const currentCodes = target.roles.map(({ role }) => role.code);
        if (this.hasManagerRole(currentCodes) && !dto.roleCodes.includes(ROLE_CODES.MANAGER)) {
          await this.ensureAnotherActiveManager(transaction, userId);
        }

        await transaction.userRole.deleteMany({ where: { userId } });
        await transaction.userRole.createMany({
          data: roles.map((role) => ({ userId, roleId: role.id })),
        });
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return this.requireUser(userId);
  }

  async revokeSessions(userId: string, actorUserId: string) {
    if (userId === actorUserId) {
      throw new BadRequestException('Use logout to revoke your own current session.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User was not found.');
    const result = await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { userId, revokedSessionCount: result.count };
  }

  private async requireUser(userId: string) {
    const user = await this.findUser(userId);
    if (!user || user.deletedAt) throw new NotFoundException('User was not found.');
    return this.projectUser(user);
  }

  private findUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  }

  private projectUser(user: NonNullable<UserRecord>) {
    const now = Date.now();
    const roles = user.roles
      .filter(({ role }) => role.isActive && !role.deletedAt && isRoleCode(role.code))
      .map(({ role, assignedAt }) => ({
        code: role.code as RoleCode,
        name: role.name,
        assignedAt: assignedAt.toISOString(),
        permissions: role.permissions
          .map(({ permission }) => permission.code)
          .filter(isPermissionCode) as PermissionCode[],
      }));
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      activeSessionCount: user.sessions.filter(({ expiresAt }) => expiresAt.getTime() > now).length,
      roles,
      effectivePermissions: [...new Set(roles.flatMap((role) => role.permissions))].sort(),
    };
  }

  private hasManagerRole(codes: readonly string[]): boolean {
    return codes.includes(ROLE_CODES.MANAGER);
  }

  private async ensureAnotherActiveManager(
    transaction: Prisma.TransactionClient,
    excludedUserId: string,
  ): Promise<void> {
    const count = await transaction.user.count({
      where: {
        id: { not: excludedUserId },
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: { code: ROLE_CODES.MANAGER, isActive: true, deletedAt: null },
          },
        },
      },
    });
    if (count === 0) throw new ConflictException('The last active manager cannot be removed.');
  }
}
