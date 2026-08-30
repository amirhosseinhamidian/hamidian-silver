import { PaymentAttemptStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import { MellatPaymentRedirectController } from './mellat-payment-redirect.controller';

describe('MellatPaymentRedirectController', () => {
  it('renders the bank POST form only for a redirected Mellat attempt', async () => {
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          provider: PAYMENT_GATEWAY_CODES.MELLAT,
          authority: 'REF123',
          status: PaymentAttemptStatus.REDIRECTED,
        }),
      },
    };
    const mellatGateway = {
      buildStartPayForm: jest.fn().mockReturnValue('<form>mellat</form>'),
    };
    const controller = new MellatPaymentRedirectController(
      prisma as unknown as PrismaService,
      mellatGateway as unknown as MellatPaymentGateway,
    );

    await expect(controller.redirect('12345678-1234-4234-8234-123456789abc')).resolves.toBe(
      '<form>mellat</form>',
    );

    expect(mellatGateway.buildStartPayForm).toHaveBeenCalledWith('REF123');
  });
});
