import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  UpdateWalletNotificationSettingsDto,
  WalletCustomerNotificationsDto,
  WalletNotificationPreferencesDto,
  WalletNotificationSettingsDto,
} from './dto/wallet-credit-notification.dto';
import { WalletCreditNotificationsService } from './wallet-credit-notifications.service';

@Controller({ path: 'notifications/wallet', version: '1' })
export class WalletCreditNotificationsController {
  constructor(private readonly notifications: WalletCreditNotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: WalletCustomerNotificationsDto })
  customer(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.notifications.customer(principal.userId);
  }

  @Patch()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: WalletCustomerNotificationsDto })
  updatePreferences(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: WalletNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(principal.userId, input);
  }

  @Get('settings')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  @ApiOkResponse({ type: WalletNotificationSettingsDto })
  settings() {
    return this.notifications.settings();
  }

  @Patch('settings')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ, PERMISSION_CODES.ORDERS_STATUS_WRITE)
  @ApiOkResponse({ type: WalletNotificationSettingsDto })
  async updateSettings(@Body() input: UpdateWalletNotificationSettingsDto) {
    const { before, after } = await this.notifications.updateSettings(input);
    const fields = {
      activationSmsEnabled: 'پیامک فعال‌سازی',
      activationIntervalMinutes: 'فاصلهٔ ارسال',
      expiryInAppEnabled: 'یادآوری انقضا در کیف پول',
      expiryNoticeDays: 'بازهٔ یادآوری انقضا',
      expiryUrgentDays: 'بازهٔ هشدار فوری',
    } as const;
    return attachHumanAuditEvent(after, {
      title: 'تنظیمات اعلان کیف پول ثبت شد.',
      operationType: 'UPDATE',
      entityName: 'wallet-credit-notifications',
      changes: (Object.keys(fields) as (keyof typeof fields)[])
        .filter((field) => before[field] !== after[field])
        .map((field) => ({
          field,
          label: fields[field],
          before: before[field],
          after: after[field],
        })),
    });
  }
}
