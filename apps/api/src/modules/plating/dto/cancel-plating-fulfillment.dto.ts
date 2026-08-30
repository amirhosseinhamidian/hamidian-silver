import { IsString, Length } from 'class-validator';

export class CancelPlatingFulfillmentDto {
  @IsString()
  @Length(3, 1000)
  reason!: string;
}
