import { IsString, Length } from 'class-validator';

export class PaymentCallbackQueryDto {
  @IsString()
  @Length(1, 255)
  authority!: string;
}
