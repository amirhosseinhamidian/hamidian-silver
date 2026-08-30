import { Expose, Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class PaymentCallbackQueryDto {
  @Expose()
  @Transform(
    ({ value, obj }: { value: unknown; obj: { Authority?: unknown } }) => value ?? obj.Authority,
    { toClassOnly: true },
  )
  @IsString()
  @Length(1, 255)
  authority!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  Authority?: string;

  @IsOptional()
  @IsIn(['OK', 'NOK'])
  status?: string;

  @IsOptional()
  @IsIn(['OK', 'NOK'])
  Status?: string;
}
