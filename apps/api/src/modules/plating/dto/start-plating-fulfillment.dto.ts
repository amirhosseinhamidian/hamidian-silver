import { IsOptional, IsString, Length } from 'class-validator';

export class StartPlatingFulfillmentDto {
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
