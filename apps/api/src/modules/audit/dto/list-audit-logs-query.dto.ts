import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AUDIT_OUTCOMES = ['SUCCESS', 'FAILURE'] as const;
export type AuditOutcomeValue = (typeof AUDIT_OUTCOMES)[number];

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(AUDIT_OUTCOMES)
  outcome?: AuditOutcomeValue;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resource?: string;

  @IsOptional()
  @IsUUID('4')
  actorUserId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
