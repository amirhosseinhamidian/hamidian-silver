import { ApiProperty } from '@nestjs/swagger';
import { AUDIT_OPERATION_TYPES, type AuditOperationType } from '../audit-event';
import { AUDIT_OUTCOMES, type AuditOutcomeValue } from './list-audit-logs-query.dto';

export class AuditLogActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  phone!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;
}

export class AuditLogChangeDto {
  field!: string;
  label!: string;

  @ApiProperty({
    nullable: true,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  before!: string | number | boolean | string[] | null;

  @ApiProperty({
    nullable: true,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  after!: string | number | boolean | string[] | null;
}

export class AuditLogEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: () => AuditLogActorDto })
  actor!: AuditLogActorDto;

  title!: string;

  @ApiProperty({ enum: AUDIT_OPERATION_TYPES })
  operationType!: AuditOperationType;

  @ApiProperty({ nullable: true })
  entityName!: string | null;

  @ApiProperty({ type: () => AuditLogChangeDto, isArray: true })
  changes!: AuditLogChangeDto[];

  action!: string;
  resource!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  resourceId!: string | null;

  method!: string;
  path!: string;
  statusCode!: number;

  @ApiProperty({ enum: AUDIT_OUTCOMES })
  outcome!: AuditOutcomeValue;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  requestId!: string | null;

  durationMs!: number;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AuditLogSummaryDto {
  total!: number;
  succeeded!: number;
  failed!: number;
  actors!: number;
  last24Hours!: number;
}

export class AuditLogSnapshotDto {
  @ApiProperty({ type: () => AuditLogEntryDto, isArray: true })
  items!: AuditLogEntryDto[];

  @ApiProperty({ type: () => AuditLogSummaryDto })
  summary!: AuditLogSummaryDto;

  @ApiProperty({ type: String, isArray: true })
  resources!: string[];

  @ApiProperty({ enum: AUDIT_OPERATION_TYPES, isArray: true })
  operationTypes!: AuditOperationType[];

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}
