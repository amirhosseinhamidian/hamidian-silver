import { IsString, Length } from 'class-validator';

export class ResolvePaymentReconciliationDto {
  @IsString()
  @Length(1, 255)
  externalRefundReference!: string;

  @IsString()
  @Length(3, 1000)
  resolutionNote!: string;
}
