import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { OperationsWorkQueueState, OperationsWorkType } from '../operations-work-queue';

export class OperationsWorkQueueQueryDto {
  @IsOptional()
  @IsIn(['PLATING', 'SHIPPING'])
  type?: OperationsWorkType;

  @IsOptional()
  @IsIn(['READY', 'BLOCKED', 'OVERDUE'])
  state?: OperationsWorkQueueState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
