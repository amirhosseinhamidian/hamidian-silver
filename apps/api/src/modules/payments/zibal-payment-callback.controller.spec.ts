import type { PaymentsService } from './payments.service';
import { ZibalPaymentCallbackController } from './zibal-payment-callback.controller';

describe('ZibalPaymentCallbackController', () => {
  it('passes the Zibal trackId through the generic payment verification flow', async () => {
    const paymentsService = {
      verifyCallback: jest.fn().mockResolvedValue({
        success: true,
      }),
    };
    const controller = new ZibalPaymentCallbackController(
      paymentsService as unknown as PaymentsService,
    );

    await controller.verifyCallback('10000000-0000-4000-8000-000000000001', {
      trackId: '1533727744287',
      status: '2',
    });

    expect(paymentsService.verifyCallback).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      '1533727744287',
    );
  });
});
