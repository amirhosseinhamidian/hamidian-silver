import type { SupplierPayablesService } from './supplier-payables.service';
import { SupplierPayablesController } from './supplier-payables.controller';

describe('SupplierPayablesController', () => {
  it('passes the authenticated finance actor when settling a payable', async () => {
    const service = {
      markPaid: jest.fn().mockResolvedValue({
        status: 'PAID',
      }),
    };
    const controller = new SupplierPayablesController(
      service as unknown as SupplierPayablesService,
    );
    const payableId = '10000000-0000-4000-8000-000000000001';
    const actorUserId = '20000000-0000-4000-8000-000000000001';
    const dto = {
      paymentReference: 'BANK-REF-1',
      note: 'Transfer confirmed.',
    };

    await controller.markPaid(payableId, dto, {
      userId: actorUserId,
    } as never);

    expect(service.markPaid).toHaveBeenCalledWith(payableId, actorUserId, dto);
  });
});
