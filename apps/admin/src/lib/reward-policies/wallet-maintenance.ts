export const walletTotalLabels = {
  availableToman: 'فعال و قابل مصرف',
  pendingToman: 'در انتظار فعال‌سازی',
  reservedToman: 'رزروشده',
  expiredToman: 'منقضیِ ثبت‌شده',
  capturedToman: 'مصرف‌شده',
  revokedToman: 'لغوشده',
  awaitingExpiryToman: 'سررسید گذشته، در انتظار ثبت انقضا',
};

export const walletIssueLabels = {
  LEDGER_MISMATCH: 'ماندهٔ بسته با دفتر کیف پول هم‌خوانی ندارد',
  RESERVATION_MISMATCH: 'مبلغ یا مالک رزرو با سفارش و دفتر هم‌خوانی ندارد',
  SETTLEMENT_MISMATCH: 'شواهد پرداخت قطعی با رزرو باز هم‌خوانی ندارد',
  RECEIPT_PENDING: 'رسید کارت‌به‌کارت در انتظار بررسی است',
  PAYMENT_UNCERTAIN: 'نتیجهٔ پرداخت درگاه نیاز به پیگیری دارد',
  RESERVATION_OVERDUE: 'مهلت سفارش گذشته و رزرو باز است',
};

type WalletIssue = {
  subject: 'LOT' | 'RESERVATION';
  subjectId: string;
  userId: string;
  orderId: string;
  orderNumber: string | null;
  code: keyof typeof walletIssueLabels;
  detectedAt: string;
  resolvedAt: string | null;
};

export type WalletMaintenanceReport = {
  asOf: string;
  enabled: boolean;
  totals: Record<keyof typeof walletTotalLabels, number>;
  issues: WalletIssue[];
  page: number;
  hasMore: boolean;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isIssue(value: unknown): value is WalletIssue {
  const issue = asObject(value);
  return Boolean(
    issue &&
    (issue.subject === 'LOT' || issue.subject === 'RESERVATION') &&
    typeof issue.subjectId === 'string' &&
    typeof issue.userId === 'string' &&
    typeof issue.orderId === 'string' &&
    (issue.orderNumber === null || typeof issue.orderNumber === 'string') &&
    typeof issue.code === 'string' &&
    Object.hasOwn(walletIssueLabels, issue.code) &&
    typeof issue.detectedAt === 'string' &&
    (issue.resolvedAt === null || typeof issue.resolvedAt === 'string'),
  );
}

export function parseWalletMaintenanceReport(value: unknown): WalletMaintenanceReport | null {
  const report = asObject(value);
  const totals = asObject(report?.totals);
  if (
    !report ||
    !totals ||
    !Object.keys(walletTotalLabels).every((key) => {
      const amount = totals[key];
      return typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0;
    }) ||
    typeof report.asOf !== 'string' ||
    typeof report.enabled !== 'boolean' ||
    typeof report.page !== 'number' ||
    !Number.isInteger(report.page) ||
    report.page < 1 ||
    typeof report.hasMore !== 'boolean' ||
    !Array.isArray(report.issues) ||
    !report.issues.every(isIssue)
  ) {
    return null;
  }
  return {
    asOf: report.asOf,
    enabled: report.enabled,
    totals: totals as WalletMaintenanceReport['totals'],
    issues: report.issues,
    page: report.page,
    hasMore: report.hasMore,
  };
}
