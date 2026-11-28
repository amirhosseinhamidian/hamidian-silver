import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  WalletBalanceDto,
  WalletCorrectionDto,
  WalletCustomerOptionDto,
  WalletCustomerSearchQueryDto,
  WalletLedgerPageDto,
  WalletLedgerQueryDto,
  WalletOperationDto,
} from './dto/wallet.dto';
import { WalletLedgerService } from './wallet-ledger.service';
import { CustomerWalletLedgerDto } from './dto/customer-wallet.dto';

@Controller({ path: 'wallet', version: '1' })
export class WalletController {
  constructor(private readonly wallet: WalletLedgerService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: WalletBalanceDto })
  balance(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.wallet.balance(principal.userId);
  }

  @Get('ledger')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: CustomerWalletLedgerDto })
  async customerHistory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: WalletLedgerQueryDto,
  ): Promise<CustomerWalletLedgerDto> {
    const result = await this.wallet.history(principal.userId, query.page ?? 1);
    return {
      ...result,
      items: result.items.map(({ id, kind, recordedAt, movements }) => ({
        id,
        kind,
        recordedAt,
        movements: movements.map(
          ({
            lotId,
            source,
            originOrderId,
            expiresAt,
            reservationOrderId,
            amountToman,
            fromBucket,
            toBucket,
          }) => ({
            lotId,
            source,
            originOrderId: source === 'PURCHASE' ? originOrderId : null,
            expiresAt,
            reservationOrderId,
            amountToman,
            fromBucket,
            toBucket,
          }),
        ),
      })),
    };
  }

  @Post('admin/customers/search')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: WalletCustomerOptionDto, isArray: true })
  customers(@Body() query: WalletCustomerSearchQueryDto) {
    return this.wallet.findCustomers(query.q);
  }

  @Get('admin/:userId')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: WalletBalanceDto })
  adminBalance(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.wallet.balance(userId);
  }

  @Get('admin/:userId/ledger')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: WalletLedgerPageDto })
  history(@Param('userId', ParseUUIDPipe) userId: string, @Query() query: WalletLedgerQueryDto) {
    return this.wallet.history(userId, query.page ?? 1);
  }

  @Post('admin/:userId/corrections')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: WalletOperationDto })
  async correct(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: WalletCorrectionDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    const request = {
      userId,
      idempotencyKey: input.requestId.toLowerCase(),
      amountToman: input.amountToman,
      reason: input.reason,
      actorUserId: actor.userId,
    };
    const result =
      input.kind === 'REVOKE_GRANT'
        ? await this.wallet.revokeGrant({ ...request, lotId: input.targetId })
        : await this.wallet.reverseCapture({ ...request, reservationId: input.targetId });
    return attachHumanAuditEvent(result, {
      title: 'اصلاح کیف پول ثبت شد.',
      operationType: 'UPDATE',
      entityName: result.id,
      changes: [
        { field: 'kind', label: 'نوع اصلاح', before: null, after: result.kind },
        { field: 'amountToman', label: 'مبلغ اصلاح', before: null, after: input.amountToman },
        { field: 'reason', label: 'دلیل اصلاح', before: null, after: result.reason },
      ],
    });
  }
}
