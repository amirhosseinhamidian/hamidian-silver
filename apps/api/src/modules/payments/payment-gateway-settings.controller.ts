import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { UpdatePaymentGatewaySettingDto } from './dto/update-payment-gateway-setting.dto';
import { PaymentGatewayRegistry } from './payment-gateway.registry';

@Controller('payments')
export class PaymentGatewaySettingsController {
  constructor(private readonly registry: PaymentGatewayRegistry) {}

  @Get('gateways')
  listAvailableGateways() {
    return this.registry.listAvailableGateways();
  }

  @Get('settings/gateways')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  listGatewaySettings() {
    return this.registry.listGatewaySettings();
  }

  @Patch('settings/gateways/:provider')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  updateGatewaySetting(
    @Param('provider') provider: string,
    @Body() dto: UpdatePaymentGatewaySettingDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.registry.updateGatewaySetting(provider, dto.isEnabled, principal.userId);
  }
}
