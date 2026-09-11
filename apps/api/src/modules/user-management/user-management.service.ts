import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  isPermissionCode,
  isRoleCode,
  PERMISSION_CODES,
  ROLE_CODES,
  type PermissionCode,
  type RoleCode,
} from '../authorization/rbac.constants';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateAdminRolePermissionsDto } from './dto/update-admin-role-permissions.dto';
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

  async listRoles() {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: { code: { in: Object.values(ROLE_CODES) }, isActive: true, deletedAt: null },
        orderBy: { code: 'asc' },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.permission.findMany({
        where: { code: { in: Object.values(PERMISSION_CODES) } },
        orderBy: { code: 'asc' },
      }),
    ]);
    return {
      roles: roles
        .filter(({ code }) => isRoleCode(code))
        .map((role) => ({
          code: role.code,
          name: role.name,
          description: role.description,
          isEditable: role.code === ROLE_CODES.ADMIN,
          assignedUserCount: role._count.users,
          permissionCodes: role.permissions
            .map(({ permission }) => permission.code)
            .filter(isPermissionCode)
            .sort(),
        })),
      permissions: permissions
        .filter(({ code }) => isPermissionCode(code))
        .map((permission) => ({
          code: permission.code,
          name: permission.name,
          description: permission.description,
        })),
    };
  }

  async updateRolePermissions(
    roleCode: string,
    dto: UpdateAdminRolePermissionsDto,
    actorRoleCodes: readonly RoleCode[],
  ) {
    if (!actorRoleCodes.includes(ROLE_CODES.MANAGER)) {
      throw new ForbiddenException('Only a manager can change role permissions.');
    }
    if (roleCode !== ROLE_CODES.ADMIN) {
      throw new BadRequestException('Only the operational admin role is editable.');
    }
    this.ensurePermissionDependencies(dto.permissionCodes);
    const previousRole = await this.prisma.$transaction(
      async (transaction) => {
        const role = await transaction.role.findFirst({
          where: { code: roleCode, isActive: true, deletedAt: null },
          include: { permissions: { include: { permission: true } } },
        });
        if (!role) throw new NotFoundException('Role was not found.');
        const permissions = await transaction.permission.findMany({
          where: { code: { in: dto.permissionCodes } },
          select: { id: true, code: true },
        });
        if (permissions.length !== dto.permissionCodes.length) {
          throw new BadRequestException('One or more requested permissions are unavailable.');
        }
        await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
        });
        await transaction.authSession.updateMany({
          where: { revokedAt: null, user: { roles: { some: { roleId: role.id } } } },
          data: { revokedAt: new Date() },
        });
        return {
          name: role.name,
          permissionCodes: role.permissions
            .map(({ permission }) => permission.code)
            .filter(isPermissionCode)
            .sort(),
        };
      },
      { isolationLevel: 'Serializable' },
    );
    const snapshot = await this.listRoles();
    const nextPermissionCodes = [...dto.permissionCodes].sort();
    const removed = previousRole.permissionCodes.filter(
      (permission) => !nextPermissionCodes.includes(permission),
    );
    const added = nextPermissionCodes.filter(
      (permission) => !previousRole.permissionCodes.includes(permission),
    );
    const title =
      removed.length === 0 && added.length === 0
        ? `دسترسی‌های نقش ${previousRole.name} بدون تغییر باقی ماند.`
        : removed.length === 1 && added.length === 0
          ? `دسترسی ${removed[0]} از نقش ${previousRole.name} حذف شد.`
          : added.length === 1 && removed.length === 0
            ? `دسترسی ${added[0]} به نقش ${previousRole.name} اضافه شد.`
            : `دسترسی‌های نقش ${previousRole.name} به‌روزرسانی شد.`;
    return attachHumanAuditEvent(snapshot, {
      title,
      operationType: 'PERMISSION_CHANGE',
      entityName: previousRole.name,
      changes:
        removed.length === 0 && added.length === 0
          ? []
          : [
              {
                field: 'permissionCodes',
                label: 'دسترسی‌ها',
                before: previousRole.permissionCodes,
                after: nextPermissionCodes,
              },
            ],
    });
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

  private ensurePermissionDependencies(codes: readonly PermissionCode[]): void {
    const granted = new Set(codes);
    const dependencies: readonly (readonly [PermissionCode, PermissionCode])[] = [
      [PERMISSION_CODES.CATALOG_WRITE, PERMISSION_CODES.CATALOG_READ],
      [PERMISSION_CODES.INVENTORY_WRITE, PERMISSION_CODES.INVENTORY_READ],
      [PERMISSION_CODES.ORDERS_STATUS_WRITE, PERMISSION_CODES.ORDERS_READ],
      [PERMISSION_CODES.ORDERS_TRACKING_WRITE, PERMISSION_CODES.ORDERS_READ],
      [PERMISSION_CODES.ORDERS_CANCEL, PERMISSION_CODES.ORDERS_READ],
      [PERMISSION_CODES.CMS_WRITE, PERMISSION_CODES.CMS_READ],
      [PERMISSION_CODES.PRICING_WRITE, PERMISSION_CODES.PRICING_READ],
      [PERMISSION_CODES.FINANCE_WRITE, PERMISSION_CODES.FINANCE_READ],
      [PERMISSION_CODES.SETTINGS_WRITE, PERMISSION_CODES.SETTINGS_READ],
      [PERMISSION_CODES.USERS_WRITE, PERMISSION_CODES.USERS_READ],
    ];
    const invalid = dependencies.find(([write, read]) => granted.has(write) && !granted.has(read));
    if (invalid) throw new BadRequestException(`${invalid[0]} requires ${invalid[1]}.`);
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
