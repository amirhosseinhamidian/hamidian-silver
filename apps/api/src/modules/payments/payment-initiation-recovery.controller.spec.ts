import {
  PaymentInitiationRecoveryResolution,
  type ResolvePaymentInitiationRecoveryDto,
} from './dto/resolve-payment-initiation-recovery.dto';
import { PaymentInitiationRecoveryController } from './payment-initiation-recovery.controller';
import type { PaymentInitiationRecoveryService } from './payment-initiation-recovery.service';

describe('PaymentInitiationRecoveryController', () => {
  it('forwards a Manager recovery resolution to the service', async () => {
    const service = {
      resolve: jest.fn().mockResolvedValue({
        status: 'FAILED',
      }),
    };
    const controller = new PaymentInitiationRecoveryController(
      service as unknown as PaymentInitiationRecoveryService,
    );
    const attemptId = '10000000-0000-4000-8000-000000000001';
    const dto: ResolvePaymentInitiationRecoveryDto = {
      resolution: PaymentInitiationRecoveryResolution.ABANDONED,
    };

    await controller.resolve(attemptId, dto);

    expect(service.resolve).toHaveBeenCalledWith(attemptId, dto);
  });
});
