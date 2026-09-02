import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OPERATIONAL_ALERT_CODES } from '../operational-alerts';

export type OperationalIncidentListStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export class ListOperationalIncidentsQueryDto {
  @IsOptional()
  @IsIn(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])
  status?: OperationalIncidentListStatus;

  @IsOptional()
  @IsIn([...OPERATIONAL_ALERT_CODES])
  code?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
