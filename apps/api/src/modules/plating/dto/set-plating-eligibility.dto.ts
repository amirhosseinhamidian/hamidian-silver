import { IsBoolean } from 'class-validator';

export class SetPlatingEligibilityDto {
  @IsBoolean()
  platingEligible!: boolean;
}
