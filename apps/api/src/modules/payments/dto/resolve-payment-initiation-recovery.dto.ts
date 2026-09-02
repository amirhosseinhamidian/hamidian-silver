import { IsEnum, IsOptional, IsString, IsUrl, Length, ValidateIf } from 'class-validator';

export enum PaymentInitiationRecoveryResolution {
  ABANDONED = 'ABANDONED',
  REDIRECTED = 'REDIRECTED',
}

export class ResolvePaymentInitiationRecoveryDto {
  @IsEnum(PaymentInitiationRecoveryResolution)
  resolution!: PaymentInitiationRecoveryResolution;

  @ValidateIf(
    (dto: ResolvePaymentInitiationRecoveryDto) =>
      dto.resolution === PaymentInitiationRecoveryResolution.REDIRECTED,
  )
  @IsString()
  @Length(1, 255)
  authority?: string;

  @ValidateIf(
    (dto: ResolvePaymentInitiationRecoveryDto) =>
      dto.resolution === PaymentInitiationRecoveryResolution.REDIRECTED,
  )
  @IsString()
  @Length(1, 2000)
  @IsUrl({ require_protocol: true })
  paymentUrl?: string;

  @IsOptional()
  @IsString()
  @Length(3, 400)
  note?: string;
}
