import type { PaymentsService } from './payments.service';
import { MellatPaymentCallbackController } from './mellat-payment-callback.controller';

describe('MellatPaymentCallbackController', () => {
  it('passes Mellat POST identifiers into the generic verification flow', async () => {
    const paymentsService = {
      verifyCallback: jest.fn().mockResolvedValue({
        success: true,
      }),
    };
    const controller = new MellatPaymentCallbackController(
      paymentsService as unknown as PaymentsService,
    );
    const attemptId = '12345678-1234-4234-8234-123456789abc';

    await controller.verifyCallback(attemptId, {
      RefId: 'REF123',
      ResCode: '0',
      SaleOrderId: '123456789',
      SaleReferenceId: '987654321',
    });

    expect(paymentsService.verifyCallback).toHaveBeenCalledWith(attemptId, 'REF123', {
      attemptId,
      resCode: '0',
      saleOrderId: '123456789',
      saleReferenceId: '987654321',
    });
  });
});
