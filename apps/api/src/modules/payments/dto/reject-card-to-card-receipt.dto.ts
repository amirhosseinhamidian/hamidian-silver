import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectCardToCardReceiptDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;
}
