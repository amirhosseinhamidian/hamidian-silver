import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { UpdatePaymentGatewaySettingDto } from './dto/update-payment-gateway-setting.dto';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import { CardToCardAccountsService } from './card-to-card-accounts.service';
import {
  CardToCardAccountResponseDto,
  CreateCardToCardAccountDto,
  UpdateCardToCardAccountDto,
} from './dto/card-to-card-account.dto';

@Controller('payments')
export class PaymentGatewaySettingsController {
  constructor(
    private readonly registry: PaymentGatewayRegistry,
    private readonly cardToCardAccounts: CardToCardAccountsService,
  ) {}

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

  @Get('settings/card-to-card/accounts')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: CardToCardAccountResponseDto, isArray: true })
  listCardToCardAccounts() {
    return this.cardToCardAccounts.listAccounts();
  }

  @Post('settings/card-to-card/accounts')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: CardToCardAccountResponseDto })
  createCardToCardAccount(
    @Body() dto: CreateCardToCardAccountDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.cardToCardAccounts.createAccount(dto, principal.userId);
  }

  @Patch('settings/card-to-card/accounts/:accountId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: CardToCardAccountResponseDto })
  updateCardToCardAccount(
    @Param('accountId', new ParseUUIDPipe({ version: '4' })) accountId: string,
    @Body() dto: UpdateCardToCardAccountDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.cardToCardAccounts.updateAccount(accountId, dto, principal.userId);
  }

  @Delete('settings/card-to-card/accounts/:accountId')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  deleteCardToCardAccount(
    @Param('accountId', new ParseUUIDPipe({ version: '4' })) accountId: string,
  ) {
    return this.cardToCardAccounts.deleteAccount(accountId);
  }
}
