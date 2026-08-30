import { IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Length(10, 20)
  phone!: string;
}
