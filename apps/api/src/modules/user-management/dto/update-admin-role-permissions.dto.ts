import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';

import { PERMISSION_CODES, type PermissionCode } from '../../authorization/rbac.constants';

export class UpdateAdminRolePermissionsDto {
  @ApiProperty({
    enum: Object.values(PERMISSION_CODES),
    isArray: true,
    minItems: 1,
    maxItems: Object.values(PERMISSION_CODES).length,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(Object.values(PERMISSION_CODES).length)
  @ArrayUnique()
  @IsIn(Object.values(PERMISSION_CODES), { each: true })
  permissionCodes!: PermissionCode[];
}
