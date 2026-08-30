import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { FulfillmentReadinessState } from '../fulfillment-readiness';

export class ListFulfillmentReadinessQueryDto {
  @IsOptional()
  @IsIn(['READY', 'BLOCKED'])
  state?: FulfillmentReadinessState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
