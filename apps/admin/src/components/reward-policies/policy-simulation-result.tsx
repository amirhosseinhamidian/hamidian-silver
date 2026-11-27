import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { TableScrollRegion } from '@/components/ui/data-table';
import { formatAdminInteger, formatAdminToman } from '@/lib/presentation/formatters';
import type {
  PolicyBasketResult,
  PolicyHistoryResult,
} from '@/lib/reward-policies/policy-simulator';
import { riskLabels } from './policy-simulation-fields';

const warnings: Record<string, string> = {
  PROMOTION_MISSING: 'برای کمپین نمونه قانون تخفیف ذخیره نشده است.',
  CAMPAIGN_NOT_ACTIVE_AT_SAMPLE_TIME:
    'کمپین در زمان نمونه فعال نیست. نتیجهٔ تخفیف پیش‌نمایش قانون ذخیره‌شده است.',
  CAMPAIGN_BUDGET_EXHAUSTED: 'بودجهٔ تخفیف کمپین تمام شده است.',
  CAMPAIGN_BUDGET_LIMIT: 'ماندهٔ بودجه، تخفیف را کاهش داد.',
  CAMPAIGN_USE_LIMIT: 'سقف دفعات استفاده از کمپین پر شده است.',
  CAMPAIGN_CUSTOMER_USE_LIMIT: 'خریدار نمونه قبلاً از کوپن یا پیشنهاد خرید اول استفاده کرده است.',
  CAMPAIGN_COUPON_MISMATCH: 'وضعیت کوپن با قانون کمپین سازگار نیست.',
  CAMPAIGN_AUDIENCE: 'خریدار نمونه خارج از جامعهٔ کمپین است.',
  CAMPAIGN_CONDITIONS: 'کالا، مبلغ یا ترکیب سبد شرایط قانون کمپین را ندارد.',
  CAMPAIGN_QUOTA_EXHAUSTED: 'سهمیهٔ آزاد یکی از اقلام سبد کافی نیست.',
  WALLET_LIMIT: 'طبق شرایط سبد، سقف مصرف یا حداقل پرداخت نقدی، اعتباری کسر نشد.',
  WALLET_COUPON_EXCLUDED: 'سیاست مصرف اعتبار با کوپن نمونه ترکیب نمی‌شود.',
  INCENTIVE_LIMIT_EXCEEDED: 'مشوق‌های این سفارش از ظرفیت یکی از سقف‌های مالی بیشترند.',
  PURCHASE_REWARD_LIMIT: 'سقف قانون یا ظرفیت دوره، پاداش خرید را کاهش داد.',
  PURCHASE_REWARD_REFERRAL_EXCLUDED: 'قانون معرفیِ اعمال‌شده با پاداش خرید ترکیب نمی‌شود.',
  REFERRAL_NOT_ELIGIBLE: 'سابقهٔ خرید معرف، خرید اول معرفی‌شونده یا شرط عدم معرفی خود برقرار نیست.',
  REFERRAL_RULE_CONDITIONS: 'اعتبار معرفی‌شونده با شرایط یا مشوق‌های سبد تطبیق ندارد.',
  REFERRAL_NO_UNEXPIRED_BUYER_RULE:
    'برای معرفی‌شونده قانون قابل استفاده در سن معرفی نمونه وجود ندارد.',
  REFERRER_RULE_CONDITIONS: 'قانون پاداش معرف با شرایط خرید یا مشوق‌های اعمال‌شده تطبیق ندارد.',
  REFERRAL_RETURN_PENDING: 'پاداش معرف تا تعیین تکلیف مرجوعی در انتظار می‌ماند.',
  REFERRAL_DELIVERY_PENDING: 'پاداش معرف پس از تحویل سفارش بررسی می‌شود.',
  REFERRAL_BUDGET_LIMIT: 'ظرفیت بودجهٔ معرفی یا مجموع مشوق‌ها کافی نیست.',
  REFERRAL_RISK_REVIEW: 'پاداش معرف به بازبینی ریسک نیاز دارد.',
  REFERRAL_RISK_HOLD: 'پاداش معرف به‌دلیل امتیاز ریسک در انتظار می‌ماند.',
  REFERRAL_RISK_REJECT: 'ارزیابی ریسک، پاداش معرف را رد می‌کند.',
};

const purchaseRanks = { FIRST: 'اول', SECOND: 'دوم', THIRD_OR_LATER: 'سوم یا بعدی' };
const riskActions = { ALLOW: 'مجاز', REVIEW: 'بازبینی', HOLD: 'تعلیق', REJECT: 'رد' };
const referralReasons = {
  AWARDED: 'واجد شرایط',
  PROGRAM_DISABLED: 'قانون فعال پیدا نشد',
  UNCONFIRMED: 'در انتظار تأیید یا فاقد شرایط اولیه',
  NO_MATCH: 'نامنطبق با شرایط',
  USE_LIMIT: 'سقف دفعات مصرف',
  BUDGET_LIMIT: 'سقف بودجه',
  VALUE_LIMIT: 'سقف مبلغ',
};

function Figures({ rows }: { rows: readonly [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-md bg-[var(--admin-color-surface-subtle)] p-3">
          <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="mt-1 break-words font-bold">
            <bdi>{value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BasketSimulationResult({ result }: { result: PolicyBasketResult }) {
  const { reward, referral, risk } = result;
  return (
    <div className="space-y-4">
      <Card title="قیمت و پرداخت نمونه">
        <Figures
          rows={[
            ['بهای اقلام', formatAdminToman(result.merchandiseToman)],
            ['تخفیف کالا', formatAdminToman(result.merchandiseDiscountToman)],
            ['ارسال پیش از تخفیف', formatAdminToman(result.shippingToman)],
            ['تخفیف ارسال', formatAdminToman(result.shippingDiscountToman)],
            ['اعتبار معرفی در پرداخت', formatAdminToman(result.referralDiscountToman)],
            ['مصرف کیف پول', formatAdminToman(result.walletToman)],
            ['مبلغ نهایی نمونه', formatAdminToman(result.payableToman)],
            ...(result.remainingCampaignBudgetToman === null
              ? []
              : [
                  [
                    'بودجهٔ آزاد کمپین پیش از سبد',
                    formatAdminToman(result.remainingCampaignBudgetToman),
                  ] as [string, string],
                ]),
          ]}
        />
        <div className="mt-4">
          <TableScrollRegion label="ریز قیمت و مشوق اقلام">
            <table className="w-full min-w-[43rem] text-start text-sm">
              <thead>
                <tr className="text-right">
                  {[
                    'کالا / واریانت',
                    'تعداد',
                    'پیش‌فرض هر واحد',
                    'قیمت هر واحد',
                    'تخفیف کالا',
                    'اعتبار معرفی',
                    'کیف پول',
                  ].map((label) => (
                    <th key={label} scope="col" className="p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((line) => (
                  <tr
                    key={JSON.stringify([line.productSlug, line.variantSku])}
                    className="border-t border-[var(--admin-color-border)]"
                  >
                    <th scope="row" className="p-2 text-start font-medium">
                      <bdi>{line.variantSku ?? line.productSlug}</bdi>
                    </th>
                    <td className="p-2">{formatAdminInteger(line.quantity)}</td>
                    <td className="p-2">
                      {line.defaultPriceToman === null
                        ? 'تنظیم نشده'
                        : formatAdminToman(line.defaultPriceToman)}
                    </td>
                    <td className="p-2">{formatAdminToman(line.unitPriceToman)}</td>
                    <td className="p-2">{formatAdminToman(line.merchandiseDiscountToman)}</td>
                    <td className="p-2">{formatAdminToman(line.referralDiscountToman)}</td>
                    <td className="p-2">{formatAdminToman(line.walletToman)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollRegion>
        </div>
      </Card>
      <Card
        title="پاداش و مصرف اعتبار"
        description={`نسخهٔ سیاست ${formatAdminInteger(reward.version)}، خرید ${purchaseRanks[reward.purchaseRank]}`}
      >
        <Figures
          rows={[
            ['مبلغ واجد شرایط پاداش', formatAdminToman(reward.rewardBaseToman)],
            ['پاداش پیش از سقف', formatAdminToman(reward.calculatedRewardToman)],
            ['سقف قابل تخصیص', formatAdminToman(reward.remainingRewardBudgetToman)],
            ['پاداش برآوردی', formatAdminToman(reward.estimatedRewardToman)],
            ['مبلغ واجد شرایط مصرف', formatAdminToman(reward.redemptionBaseToman)],
            ['حداکثر مصرف نمونه', formatAdminToman(reward.maxRedemptionToman)],
            [
              'فعال‌سازی پس از تحویل',
              result.activationDelayDays === 0
                ? 'بلافاصله'
                : `${formatAdminInteger(result.activationDelayDays)} روز`,
            ],
            ['مهلت سیاست پاداش', `${formatAdminInteger(reward.expiryDays)} روز`],
            ['کد قانون پاداش', reward.grantRuleCode ?? 'قانون منطبق پیدا نشد'],
            ['کد پلکان مصرف', reward.redemptionBandCode ?? 'پلکان منطبق پیدا نشد'],
          ]}
        />
      </Card>
      {referral && (
        <Card title="اعتبار معرفی و ریسک">
          <ul className="space-y-2 text-sm">
            {referral.recipients.map((line) => (
              <li key={line.recipient}>
                {line.recipient === 'REFERRER' ? 'معرف' : 'معرفی‌شونده'}،{' '}
                {formatAdminToman(line.amountToman)}، {referralReasons[line.reason]}
                {line.expiryDays ? `، مهلت ${formatAdminInteger(line.expiryDays)} روز` : ''}
                {line.ruleCode && (
                  <>
                    ، قانون <bdi>{line.ruleCode}</bdi>
                  </>
                )}
              </li>
            ))}
          </ul>
          {risk && (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                تصمیم ریسک {riskActions[risk.action]}، امتیاز {formatAdminInteger(risk.score)}
              </p>
              <p>
                نسخهٔ ریسک{' '}
                {result.resolvedRiskVersion === null
                  ? 'پیش‌فرض سامانه'
                  : formatAdminInteger(result.resolvedRiskVersion)}
              </p>
              {risk.evidence.length > 0 && (
                <ul className="list-inside list-disc">
                  {risk.evidence.map((entry) => (
                    <li key={entry.code}>
                      {riskLabels[entry.code]}، امتیاز {formatAdminInteger(entry.weight)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}
      {result.warnings.length > 0 && (
        <Alert tone="warning" title="هشدارهای سناریو">
          <ul className="list-inside list-disc">
            {result.warnings.map((reason) => (
              <li key={reason}>{warnings[reason] ?? <bdi>{reason}</bdi>}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}

export function HistorySimulationResult({ result }: { result: PolicyHistoryResult }) {
  return (
    <Card
      title={result.pendingOnly ? 'برآورد پاداش در صف انتظار' : 'مرور تاریخی پاداش خرید'}
      description={`نسخهٔ سیاست ${formatAdminInteger(result.version)}`}
    >
      <Figures
        rows={[
          ['سفارش‌های نمونه', formatAdminInteger(result.scannedOrders)],
          ['سفارش‌های ارزیابی‌شده', formatAdminInteger(result.evaluatedOrders)],
          [
            result.pendingOnly ? 'فاقد شواهد یا شرایط' : 'بدون شواهد کافی',
            formatAdminInteger(result.withoutEvidence),
          ],
          ...(!result.pendingOnly
            ? [
                ['پاداش نمونهٔ ثبت‌شده', formatAdminToman(result.recordedRewardToman)] as [
                  string,
                  string,
                ],
              ]
            : []),
          ['برآورد نسخهٔ جدید در نمونه', formatAdminToman(result.estimatedRewardToman)],
          ['سفارش‌های برخوردکرده به سقف', formatAdminInteger(result.limitedOrders)],
        ]}
      />
      {!result.evaluatedOrders && (
        <p className="mt-3 text-sm">در این بازه دادهٔ کافی برای برآورد وجود ندارد.</p>
      )}
      {result.truncated && (
        <p className="mt-3 text-sm">
          حداکثر {formatAdminInteger(result.pendingOnly ? 12 : 100)} سفارش اول بررسی شدند.
        </p>
      )}
      {result.pendingOnly && (
        <p className="mt-3 text-sm">
          جمع نمونه برآورد مستقل سفارش‌ها با ماندهٔ فعلی سقف‌هاست. سقف دوره بین این سفارش‌ها پخش
          نشده است.
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--admin-color-muted)]">
        اثرانگشت دادهٔ محاسبه <bdi className="break-all">{result.fingerprint}</bdi>
      </p>
    </Card>
  );
}
