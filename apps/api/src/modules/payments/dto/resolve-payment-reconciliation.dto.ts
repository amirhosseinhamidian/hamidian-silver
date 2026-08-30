import { IsString, Length } from 'class-validator';

export class ResolvePaymentReconciliationDto {
  @IsString()
  @Length(3, 1000)
  resolutionNote!: string;
}
