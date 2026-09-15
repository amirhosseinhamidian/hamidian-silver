import { ApiProperty } from '@nestjs/swagger';
import {
  PERMISSION_CODES,
  ROLE_CODES,
  type PermissionCode,
  type RoleCode,
} from '../../authorization/rbac.constants';

export class AuthUserResponseDto {
  id!: string;
  phone!: string;
}

export class OtpRequestResponseDto {
  challengeId!: string;
  expiresAt!: Date;
}

export class LoginResponseDto {
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  expiresAt!: Date;
  user!: AuthUserResponseDto;
}

export class CurrentUserResponseDto {
  id!: string;
  phone!: string;

  @ApiProperty({ enum: Object.values(ROLE_CODES), isArray: true })
  roles!: RoleCode[];

  @ApiProperty({ enum: Object.values(PERMISSION_CODES), isArray: true })
  permissions!: PermissionCode[];
}
