import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentCallbackQueryDto } from './dto/payment-callback-query.dto';
import { PaymentInitiationResponseDto } from './dto/payment-initiation-response.dto';
import { RejectCardToCardReceiptDto } from './dto/reject-card-to-card-receipt.dto';
import { SubmitCardToCardReceiptDto } from './dto/submit-card-to-card-receipt.dto';
import { PaymentsService, type PaymentReceiptUpload } from './payments.service';
import { CardToCardAccountsService } from './card-to-card-accounts.service';
import { PublicCardToCardSettingsDto } from './dto/card-to-card-account.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly cardToCardAccounts: CardToCardAccountsService,
  ) {}

  @Get('card-to-card/settings')
  @ApiOkResponse({ type: PublicCardToCardSettingsDto })
  getCardToCardSettings() {
    return this.cardToCardAccounts.getPublicSettings();
  }

  @Post('orders/:orderId/card-to-card/receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['idempotencyKey', 'file'],
      properties: {
        idempotencyKey: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  submitCardToCardReceipt(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: SubmitCardToCardReceiptDto,
    @UploadedFile() file?: PaymentReceiptUpload,
  ) {
    return this.paymentsService.submitCardToCardReceipt(
      principal.userId,
      orderId,
      dto.idempotencyKey,
      file,
    );
  }

  @Get('attempts/:attemptId/receipt')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  async getCardToCardReceipt(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const receipt = await this.paymentsService.getCardToCardReceipt(attemptId);
    response.set({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(receipt.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(receipt.data);
  }

  @Get('orders/:orderId/card-to-card/receipt')
  async getMyCardToCardReceipt(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const receipt = await this.paymentsService.getCustomerCardToCardReceipt(
      principal.userId,
      orderId,
    );
    response.set({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(receipt.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(receipt.data);
  }

  @Post('attempts/:attemptId/receipt/confirm')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  confirmCardToCardReceipt(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
  ) {
    return this.paymentsService.confirmCardToCardReceipt(attemptId, principal.userId);
  }

  @Post('attempts/:attemptId/receipt/reject')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  rejectCardToCardReceipt(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Body() dto: RejectCardToCardReceiptDto,
  ) {
    return this.paymentsService.rejectCardToCardReceipt(attemptId, principal.userId, dto.reason);
  }

  @Post('orders/:orderId/initiate')
  @ApiCreatedResponse({ type: PaymentInitiationResponseDto })
  initiateOrderPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiateOrderPayment(principal.userId, orderId, dto);
  }

  @Get('orders/:orderId')
  getOrderPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.paymentsService.getOrderPayment(principal.userId, orderId);
  }

  @Public()
  @Get('callback/:attemptId')
  verifyCallback(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' })) attemptId: string,
    @Query() query: PaymentCallbackQueryDto,
  ) {
    return this.paymentsService.verifyCallback(attemptId, query.authority);
  }
}
