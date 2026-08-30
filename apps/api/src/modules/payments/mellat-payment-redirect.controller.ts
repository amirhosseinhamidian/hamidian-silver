import {
  ConflictException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentAttemptStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public } from '../auth/public.decorator';
import { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';

@Controller('payments')
export class MellatPaymentRedirectController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mellatGateway: MellatPaymentGateway,
  ) {}

  @Public()
  @Get('redirect/:attemptId/mellat')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async redirect(
    @Param('attemptId', new ParseUUIDPipe({ version: '4' }))
    attemptId: string,
  ) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: {
        id: attemptId,
      },
      select: {
        provider: true,
        authority: true,
        status: true,
      },
    });

    if (!attempt || attempt.provider !== PAYMENT_GATEWAY_CODES.MELLAT || !attempt.authority) {
      throw new NotFoundException('Mellat payment attempt was not found.');
    }

    if (attempt.status !== PaymentAttemptStatus.REDIRECTED) {
      throw new ConflictException('Mellat payment attempt can no longer be redirected.');
    }

    return this.mellatGateway.buildStartPayForm(attempt.authority);
  }
}
