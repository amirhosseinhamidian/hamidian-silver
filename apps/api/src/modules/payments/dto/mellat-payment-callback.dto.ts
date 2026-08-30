import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

const toStringValue = ({ value }: { value: unknown }) =>
  value === undefined || value === null ? value : String(value);

export class MellatPaymentCallbackDto {
  @Transform(toStringValue)
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/)
  RefId!: string;

  @Transform(toStringValue)
  @IsString()
  @Matches(/^\d+$/)
  ResCode!: string;

  @IsOptional()
  @Transform(toStringValue)
  @IsString()
  @Matches(/^\d+$/)
  SaleOrderId?: string;

  @IsOptional()
  @Transform(toStringValue)
  @IsString()
  @Matches(/^\d+$/)
  SaleReferenceId?: string;
}
