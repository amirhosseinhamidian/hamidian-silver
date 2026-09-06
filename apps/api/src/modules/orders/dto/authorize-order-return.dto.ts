import { IsString, Length } from 'class-validator';

export class AuthorizeOrderReturnDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
