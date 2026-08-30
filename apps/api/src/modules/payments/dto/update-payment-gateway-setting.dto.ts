import { IsBoolean } from 'class-validator';

export class UpdatePaymentGatewaySettingDto {
  @IsBoolean()
  isEnabled!: boolean;
}
