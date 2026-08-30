import { IsString, Length, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @Length(8, 120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}
