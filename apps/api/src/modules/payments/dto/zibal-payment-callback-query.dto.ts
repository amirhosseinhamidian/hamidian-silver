import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ZibalPaymentCallbackQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null ? value : String(value),
  )
  @IsString()
  @Matches(/^\d+$/)
  trackId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null ? value : String(value),
  )
  @IsString()
  @Matches(/^-?\d+$/)
  status?: string;
}
