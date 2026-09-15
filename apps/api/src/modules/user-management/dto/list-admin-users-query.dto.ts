import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const ADMIN_USER_STATUS_FILTERS = ['ACTIVE', 'INACTIVE'] as const;
export const ADMIN_USER_ROLE_FILTERS = ['MANAGER', 'ADMIN', 'USER'] as const;

export class ListAdminUsersQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ADMIN_USER_STATUS_FILTERS })
  @IsOptional()
  @IsIn(ADMIN_USER_STATUS_FILTERS)
  status?: (typeof ADMIN_USER_STATUS_FILTERS)[number];

  @ApiPropertyOptional({ enum: ADMIN_USER_ROLE_FILTERS })
  @IsOptional()
  @IsIn(ADMIN_USER_ROLE_FILTERS)
  role?: (typeof ADMIN_USER_ROLE_FILTERS)[number];

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
