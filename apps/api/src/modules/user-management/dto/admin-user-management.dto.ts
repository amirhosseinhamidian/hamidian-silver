import { ApiProperty } from '@nestjs/swagger';

import { PERMISSION_CODES, ROLE_CODES } from '../../authorization/rbac.constants';

export class AdminPermissionCatalogDto {
  @ApiProperty({ enum: Object.values(PERMISSION_CODES) })
  code!: string;

  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;
}

export class AdminRoleCatalogDto {
  @ApiProperty({ enum: Object.values(ROLE_CODES) })
  code!: string;

  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: () => AdminPermissionCatalogDto, isArray: true })
  permissions!: AdminPermissionCatalogDto[];
}

export class AdminManagedUserRoleDto {
  @ApiProperty({ enum: Object.values(ROLE_CODES) })
  code!: string;

  name!: string;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: string;

  @ApiProperty({ enum: Object.values(PERMISSION_CODES), isArray: true })
  permissions!: string[];
}

export class AdminManagedUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  phone!: string;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;

  isActive!: boolean;

  @ApiProperty({ nullable: true, format: 'date-time' })
  phoneVerifiedAt!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  activeSessionCount!: number;

  @ApiProperty({ type: () => AdminManagedUserRoleDto, isArray: true })
  roles!: AdminManagedUserRoleDto[];

  @ApiProperty({ enum: Object.values(PERMISSION_CODES), isArray: true })
  effectivePermissions!: string[];
}

export class AdminUserManagementSnapshotDto {
  @ApiProperty({ type: () => AdminManagedUserDto, isArray: true })
  users!: AdminManagedUserDto[];

  @ApiProperty({ type: () => AdminRoleCatalogDto, isArray: true })
  roles!: AdminRoleCatalogDto[];
}

export class RevokeAdminUserSessionsResultDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  revokedSessionCount!: number;
}
