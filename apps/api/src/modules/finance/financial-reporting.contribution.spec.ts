import { OrderCostEntryType, PaymentRefundStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { FinancialReportingService } from './financial-reporting.service';

describe('FinancialReportingService contribution reporting', () => {
  it('reports service costs by recognition date without mixing them into cashflow', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            grossMarginBeforeServiceCostsToman: 1_000_000,
          },
        }),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountToman: 120_000 },
          _count: { _all: 1 },
        }),
      },
      orderCostEntry: {
        groupBy: jest.fn().mockResolvedValue([
          {
            type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
            _sum: { amountToman: 40_000 },
            _count: { _all: 2 },
          },
          {
            type: OrderCostEntryType.SHIPPING_PROVIDER,
            _sum: { amountToman: 90_000 },
            _count: { _all: 2 },
          },
          {
            type: OrderCostEntryType.MANUAL_ADJUSTMENT,
            _sum: { amountToman: -10_000 },
            _count: { _all: 2 },
          },
        ]),
      },
    };
    const service = new FinancialReportingService(prisma as unknown as PrismaService);

    await expect(service.contribution({})).resolves.toEqual(
      expect.objectContaining({
        paidOrderCount: 2,
        grossProfitBeforeServiceCostsToman: 1_000_000,
        paymentGatewayFeeToman: 40_000,
        shippingProviderCostToman: 90_000,
        manualCostAdjustmentToman: -10_000,
        operatingServiceCostToman: 120_000,
        confirmedRefundToman: 120_000,
        contributionMarginToman: 880_000,
        contributionAfterRefundsToman: 760_000,
      }),
    );

    expect(prisma.paymentRefund.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentRefundStatus.CONFIRMED,
        }),
      }),
    );
  });
});
