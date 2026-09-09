import { ApiProperty } from '@nestjs/swagger';

import { PERMISSION_CODES, ROLE_CODES } from '../../authorization/rbac.constants';

export class AdminManagedPermissionDto {
  @ApiProperty({ enum: Object.values(PERMISSION_CODES) })
  code!: string;
  name!: string;
  @ApiProperty({ nullable: true })
  description!: string | null;
}

export class AdminManagedRoleDto {
  @ApiProperty({ enum: Object.values(ROLE_CODES) })
  code!: string;
  name!: string;
  @ApiProperty({ nullable: true })
  description!: string | null;
  isEditable!: boolean;
  assignedUserCount!: number;
  @ApiProperty({ enum: Object.values(PERMISSION_CODES), isArray: true })
  permissionCodes!: string[];
}

export class AdminRoleManagementSnapshotDto {
  @ApiProperty({ type: () => AdminManagedRoleDto, isArray: true })
  roles!: AdminManagedRoleDto[];
  @ApiProperty({ type: () => AdminManagedPermissionDto, isArray: true })
  permissions!: AdminManagedPermissionDto[];
}
