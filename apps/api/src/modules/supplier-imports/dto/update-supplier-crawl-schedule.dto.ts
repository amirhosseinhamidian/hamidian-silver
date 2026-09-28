import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateSupplierCrawlScheduleDto {
  @IsBoolean()
  isEnabled!: boolean;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  timeOfDay!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @IsInt()
  @Min(1)
  @Max(500)
  requestedLimit!: number;

  @IsBoolean()
  stopAtKnown!: boolean;

  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  retryDelayMinutes!: number;
}
