import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { ROLE_CODES, type RoleCode } from '../../authorization/rbac.constants';

export class UpdateAdminUserRolesDto {
  @ApiProperty({
    enum: Object.values(ROLE_CODES),
    isArray: true,
    minItems: 1,
    maxItems: 3,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(Object.values(ROLE_CODES), { each: true })
  roleCodes!: RoleCode[];
}
