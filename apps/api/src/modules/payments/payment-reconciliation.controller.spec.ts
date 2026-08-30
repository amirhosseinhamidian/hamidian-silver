import type { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentReconciliationController } from './payment-reconciliation.controller';

describe('PaymentReconciliationController', () => {
  it('resolves an external refund with the authenticated Manager as actor', async () => {
    const service = {
      resolveExternalRefund: jest.fn().mockResolvedValue({
        status: 'RESOLVED',
      }),
    };
    const controller = new PaymentReconciliationController(
      service as unknown as PaymentReconciliationService,
    );
    const reconciliationId = '10000000-0000-4000-8000-000000000001';
    const actorUserId = '20000000-0000-4000-8000-000000000001';

    await controller.resolveExternalRefund(
      reconciliationId,
      {
        resolutionNote: 'Refund confirmed externally.',
      },
      {
        userId: actorUserId,
      } as never,
    );

    expect(service.resolveExternalRefund).toHaveBeenCalledWith(
      reconciliationId,
      actorUserId,
      'Refund confirmed externally.',
    );
  });
});
