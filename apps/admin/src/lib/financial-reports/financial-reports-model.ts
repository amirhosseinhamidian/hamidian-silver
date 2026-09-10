export type FinancialReportPeriod = '7d' | '30d' | '90d' | 'all';

export type FinancialReportRange = Readonly<{
  period: FinancialReportPeriod;
  from: string | null;
  to: string | null;
}>;

export type FinanceManagementReport = Readonly<{
  paidOrderCount: number;
  customerGrossCollectedToman: number;
  confirmedRefundToman: number;
  confirmedRefundCount: number;
  customerNetCollectedToman: number;
  grossProfitBeforeServiceCostsToman: number;
  netOperatingCashflowToman: number;
  supplierPosition: Readonly<{
    openPayableToman: number;
    openPayableCount: number;
    availableCreditToman: number;
    availableCreditCount: number;
    draftAppliedCreditToman: number;
    draftSettlementCount: number;
    creditOffsetToman: number;
    netLiabilityToman: number;
  }>;
  supplierPayments: Readonly<{
    settledGrossToman: number;
    settledCreditToman: number;
    settledCashPaidToman: number;
    settlementCount: number;
    directCashPaidToman: number;
    directPayableCount: number;
    totalCashPaidToman: number;
  }>;
}>;

export type FinanceCashflowReport = Readonly<{
  customerCashInToman: number;
  customerCashInOrderCount: number;
  customerRefundCashOutToman: number;
  customerRefundCount: number;
  supplierSettlementGrossToman: number;
  supplierSettlementCreditToman: number;
  supplierSettlementCashOutToman: number;
  supplierSettlementCount: number;
  supplierDirectCashOutToman: number;
  supplierDirectPaymentCount: number;
  supplierCashOutToman: number;
  netOperatingCashflowToman: number;
}>;

export type FinanceContributionReport = Readonly<{
  paidOrderCount: number;
  grossProfitBeforeServiceCostsToman: number;
  paymentGatewayFeeToman: number;
  shippingProviderCostToman: number;
  platingServiceCostToman: number;
  manualCostAdjustmentToman: number;
  operatingServiceCostToman: number;
  costEntryCount: number;
  confirmedRefundToman: number;
  confirmedRefundCount: number;
  contributionMarginToman: number;
  contributionAfterRefundsToman: number;
}>;

export type FinanceSupplierRow = Readonly<{
  supplierId: string;
  supplierName: string;
  openPayableToman: number;
  openPayableCount: number;
  availableCreditToman: number;
  availableCreditCount: number;
  draftAppliedCreditToman: number;
  settledGrossToman: number;
  settledCreditToman: number;
  settledCashPaidToman: number;
  settlementCount: number;
  directCashPaidToman: number;
  directPayableCount: number;
  creditOffsetToman: number;
  netLiabilityToman: number;
  totalSupplierCashPaidToman: number;
}>;

export type MissingOrderCostCode =
  'PAYMENT_GATEWAY_FEE_MISSING' | 'SHIPPING_PROVIDER_COST_MISSING' | 'PLATING_SERVICE_COST_MISSING';

export type FinanceCostReconciliationRow = Readonly<{
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paidAt: string | null;
  financeSnapshotReady: boolean;
  missingCosts: readonly MissingOrderCostCode[];
}>;

export type FinanceCostReconciliationReport = Readonly<{
  count: number;
  orders: readonly FinanceCostReconciliationRow[];
}>;

type UnknownRecord = Record<string, unknown>;

const PERIODS: ReadonlySet<FinancialReportPeriod> = new Set(['7d', '30d', '90d', 'all']);
const MISSING_COST_CODES: ReadonlySet<MissingOrderCostCode> = new Set([
  'PAYMENT_GATEWAY_FEE_MISSING',
  'SHIPPING_PROVIDER_COST_MISSING',
  'PLATING_SERVICE_COST_MISSING',
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = number(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function nullableDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  const parsed = text(value);
  return parsed && !Number.isNaN(new Date(parsed).getTime()) ? parsed : undefined;
}

function allNumbers(source: UnknownRecord, keys: readonly string[], nonNegative = true) {
  const values = keys.map((key) =>
    nonNegative ? nonNegativeNumber(source[key]) : number(source[key]),
  );
  return values.some((value) => value === null) ? null : values;
}

export function parseFinancialReportPeriod(
  value: string | string[] | undefined,
): FinancialReportPeriod {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && PERIODS.has(candidate as FinancialReportPeriod)
    ? (candidate as FinancialReportPeriod)
    : '30d';
}

export function financialReportRange(
  period: FinancialReportPeriod,
  now = new Date(),
): FinancialReportRange {
  if (period === 'all') return { period, from: null, to: null };

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  return {
    period,
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1_000).toISOString(),
    to: now.toISOString(),
  };
}

export function parseFinanceManagementReport(value: unknown): FinanceManagementReport | null {
  const source = record(value);
  const supplierPosition = record(source?.supplierPosition);
  const supplierPayments = record(source?.supplierPayments);
  if (!source || !supplierPosition || !supplierPayments) return null;

  const rootValues = allNumbers(source, [
    'paidOrderCount',
    'customerGrossCollectedToman',
    'confirmedRefundToman',
    'confirmedRefundCount',
  ]);
  const signedRootValues = allNumbers(
    source,
    [
      'customerNetCollectedToman',
      'grossProfitBeforeServiceCostsToman',
      'netOperatingCashflowToman',
    ],
    false,
  );
  const positionValues = allNumbers(supplierPosition, [
    'openPayableToman',
    'openPayableCount',
    'availableCreditToman',
    'availableCreditCount',
    'draftAppliedCreditToman',
    'draftSettlementCount',
    'creditOffsetToman',
  ]);
  const liability = number(supplierPosition.netLiabilityToman);
  const paymentValues = allNumbers(supplierPayments, [
    'settledGrossToman',
    'settledCreditToman',
    'settledCashPaidToman',
    'settlementCount',
    'directCashPaidToman',
    'directPayableCount',
    'totalCashPaidToman',
  ]);

  if (!rootValues || !signedRootValues || !positionValues || liability === null || !paymentValues) {
    return null;
  }

  return {
    paidOrderCount: rootValues[0]!,
    customerGrossCollectedToman: rootValues[1]!,
    confirmedRefundToman: rootValues[2]!,
    confirmedRefundCount: rootValues[3]!,
    customerNetCollectedToman: signedRootValues[0]!,
    grossProfitBeforeServiceCostsToman: signedRootValues[1]!,
    netOperatingCashflowToman: signedRootValues[2]!,
    supplierPosition: {
      openPayableToman: positionValues[0]!,
      openPayableCount: positionValues[1]!,
      availableCreditToman: positionValues[2]!,
      availableCreditCount: positionValues[3]!,
      draftAppliedCreditToman: positionValues[4]!,
      draftSettlementCount: positionValues[5]!,
      creditOffsetToman: positionValues[6]!,
      netLiabilityToman: liability,
    },
    supplierPayments: {
      settledGrossToman: paymentValues[0]!,
      settledCreditToman: paymentValues[1]!,
      settledCashPaidToman: paymentValues[2]!,
      settlementCount: paymentValues[3]!,
      directCashPaidToman: paymentValues[4]!,
      directPayableCount: paymentValues[5]!,
      totalCashPaidToman: paymentValues[6]!,
    },
  };
}

export function parseFinanceCashflowReport(value: unknown): FinanceCashflowReport | null {
  const source = record(value);
  if (!source) return null;
  const values = allNumbers(source, [
    'customerCashInToman',
    'customerCashInOrderCount',
    'customerRefundCashOutToman',
    'customerRefundCount',
    'supplierSettlementGrossToman',
    'supplierSettlementCreditToman',
    'supplierSettlementCashOutToman',
    'supplierSettlementCount',
    'supplierDirectCashOutToman',
    'supplierDirectPaymentCount',
    'supplierCashOutToman',
  ]);
  const net = number(source.netOperatingCashflowToman);
  if (!values || net === null) return null;

  return {
    customerCashInToman: values[0]!,
    customerCashInOrderCount: values[1]!,
    customerRefundCashOutToman: values[2]!,
    customerRefundCount: values[3]!,
    supplierSettlementGrossToman: values[4]!,
    supplierSettlementCreditToman: values[5]!,
    supplierSettlementCashOutToman: values[6]!,
    supplierSettlementCount: values[7]!,
    supplierDirectCashOutToman: values[8]!,
    supplierDirectPaymentCount: values[9]!,
    supplierCashOutToman: values[10]!,
    netOperatingCashflowToman: net,
  };
}

export function parseFinanceContributionReport(value: unknown): FinanceContributionReport | null {
  const source = record(value);
  if (!source) return null;
  const countValues = allNumbers(source, [
    'paidOrderCount',
    'costEntryCount',
    'confirmedRefundCount',
  ]);
  const amountValues = allNumbers(
    source,
    [
      'grossProfitBeforeServiceCostsToman',
      'paymentGatewayFeeToman',
      'shippingProviderCostToman',
      'platingServiceCostToman',
      'manualCostAdjustmentToman',
      'operatingServiceCostToman',
      'confirmedRefundToman',
      'contributionMarginToman',
      'contributionAfterRefundsToman',
    ],
    false,
  );
  if (!countValues || !amountValues) return null;

  return {
    paidOrderCount: countValues[0]!,
    costEntryCount: countValues[1]!,
    confirmedRefundCount: countValues[2]!,
    grossProfitBeforeServiceCostsToman: amountValues[0]!,
    paymentGatewayFeeToman: amountValues[1]!,
    shippingProviderCostToman: amountValues[2]!,
    platingServiceCostToman: amountValues[3]!,
    manualCostAdjustmentToman: amountValues[4]!,
    operatingServiceCostToman: amountValues[5]!,
    confirmedRefundToman: amountValues[6]!,
    contributionMarginToman: amountValues[7]!,
    contributionAfterRefundsToman: amountValues[8]!,
  };
}

function parseSupplier(value: unknown): FinanceSupplierRow | null {
  const source = record(value);
  const supplierId = text(source?.supplierId);
  const supplierName = text(source?.supplierName);
  if (!source || !supplierId || !supplierName) return null;
  const nonNegativeValues = allNumbers(source, [
    'openPayableToman',
    'openPayableCount',
    'availableCreditToman',
    'availableCreditCount',
    'draftAppliedCreditToman',
    'settledGrossToman',
    'settledCreditToman',
    'settledCashPaidToman',
    'settlementCount',
    'directCashPaidToman',
    'directPayableCount',
    'creditOffsetToman',
    'totalSupplierCashPaidToman',
  ]);
  const netLiabilityToman = number(source.netLiabilityToman);
  if (!nonNegativeValues || netLiabilityToman === null) return null;

  return {
    supplierId,
    supplierName,
    openPayableToman: nonNegativeValues[0]!,
    openPayableCount: nonNegativeValues[1]!,
    availableCreditToman: nonNegativeValues[2]!,
    availableCreditCount: nonNegativeValues[3]!,
    draftAppliedCreditToman: nonNegativeValues[4]!,
    settledGrossToman: nonNegativeValues[5]!,
    settledCreditToman: nonNegativeValues[6]!,
    settledCashPaidToman: nonNegativeValues[7]!,
    settlementCount: nonNegativeValues[8]!,
    directCashPaidToman: nonNegativeValues[9]!,
    directPayableCount: nonNegativeValues[10]!,
    creditOffsetToman: nonNegativeValues[11]!,
    netLiabilityToman,
    totalSupplierCashPaidToman: nonNegativeValues[12]!,
  };
}

export function parseFinanceSuppliersReport(value: unknown): readonly FinanceSupplierRow[] | null {
  const source = record(value);
  if (!source || !Array.isArray(source.suppliers)) return null;
  const suppliers = source.suppliers.map(parseSupplier);
  return suppliers.some((supplier) => supplier === null)
    ? null
    : (suppliers as FinanceSupplierRow[]);
}

function parseMissingCost(value: unknown): MissingOrderCostCode | null {
  const source = record(value);
  const code = text(source?.code) as MissingOrderCostCode | null;
  return code && MISSING_COST_CODES.has(code) ? code : null;
}

function parseReconciliationOrder(value: unknown): FinanceCostReconciliationRow | null {
  const source = record(value);
  const orderId = text(source?.orderId);
  const orderNumber = text(source?.orderNumber);
  const orderStatus = text(source?.orderStatus);
  const paidAt = nullableDate(source?.paidAt);
  if (
    !source ||
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    paidAt === undefined ||
    typeof source.financeSnapshotReady !== 'boolean' ||
    !Array.isArray(source.missingCosts)
  ) {
    return null;
  }
  const missingCosts = source.missingCosts.map(parseMissingCost);
  if (missingCosts.some((code) => code === null)) return null;

  return {
    orderId,
    orderNumber,
    orderStatus,
    paidAt,
    financeSnapshotReady: source.financeSnapshotReady,
    missingCosts: missingCosts as MissingOrderCostCode[],
  };
}

export function parseFinanceCostReconciliationReport(
  value: unknown,
): FinanceCostReconciliationReport | null {
  const source = record(value);
  const count = nonNegativeNumber(source?.count);
  if (!source || count === null || !Array.isArray(source.orders)) return null;
  const orders = source.orders.map(parseReconciliationOrder);
  if (orders.some((order) => order === null) || count !== orders.length) return null;
  return { count, orders: orders as FinanceCostReconciliationRow[] };
}
