import { OrderExpirationScheduler } from './order-expiration.scheduler';
import type { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationScheduler', () => {
  const orderExpirationService = {
    expireDueOrders: jest.fn(),
  };

  let scheduler: OrderExpirationScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new OrderExpirationScheduler(
      orderExpirationService as unknown as OrderExpirationService,
    );
  });

  it('runs the expiration sweep', async () => {
    orderExpirationService.expireDueOrders.mockResolvedValue({
      scanned: 3,
      expired: 2,
      skipped: 1,
    });

    await scheduler.handleExpirationTick();

    expect(orderExpirationService.expireDueOrders).toHaveBeenCalledTimes(1);
  });

  it('does not overlap when a previous sweep is still running', async () => {
    let resolveSweep!: () => void;
    const pendingSweep = new Promise<void>((resolve) => {
      resolveSweep = resolve;
    });

    orderExpirationService.expireDueOrders.mockImplementation(async () => {
      await pendingSweep;

      return {
        scanned: 1,
        expired: 1,
        skipped: 0,
      };
    });

    const firstRun = scheduler.handleExpirationTick();
    await Promise.resolve();

    await scheduler.handleExpirationTick();

    expect(orderExpirationService.expireDueOrders).toHaveBeenCalledTimes(1);

    resolveSweep();
    await firstRun;
  });

  it('releases the overlap guard even when a sweep fails', async () => {
    orderExpirationService.expireDueOrders
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        scanned: 0,
        expired: 0,
        skipped: 0,
      });

    await scheduler.handleExpirationTick();
    await scheduler.handleExpirationTick();

    expect(orderExpirationService.expireDueOrders).toHaveBeenCalledTimes(2);
  });

  it('does not throw scheduler errors back to the cron runner', async () => {
    orderExpirationService.expireDueOrders.mockRejectedValue(new Error('temporary failure'));

    await expect(scheduler.handleExpirationTick()).resolves.toBeUndefined();
  });
});
