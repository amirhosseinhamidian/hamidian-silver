'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { formatCalendarDay, readCalendarValue } from '@/lib/presentation/dual-calendar';
import {
  formatAdminInteger,
  parseAdminWholeToman,
  toAsciiDigits,
} from '@/lib/presentation/formatters';
import { readReferralText, referralInstant } from '@/lib/reward-policies/referral-reward-policy';

const usages = {
  customerRewardsToman: 'پاداش قبلی مشتری در دوره',
  periodRewardsToman: 'کل پاداش قبلی دوره',
  customerIncentivesToman: 'مشوق‌های قبلی مشتری در دوره',
  periodIncentivesToman: 'کل مشوق‌های قبلی دوره',
};

export const riskLabels = {
  SELF_REFERRAL: 'معرفی خود (۰ یا ۱)',
  SHARED_DEVICE: 'دستگاه مشترک',
  SHARED_NETWORK: 'شبکهٔ مشترک',
  SHARED_ADDRESS: 'شباهت نشانی (۰ تا ۱۰۰)',
  SHARED_RECIPIENT: 'شباهت گیرنده (۰ تا ۱۰۰)',
  VERIFIED_PAYMENT_REUSE: 'استفادهٔ دوباره از پرداخت تأییدشده',
  REFERRAL_FREQUENCY: 'دفعات معرفی',
  CANCELLED_ORDERS: 'تعداد سفارش‌های لغوشده',
  FAST_PAYMENT: 'فاصلهٔ ثبت تا پرداخت',
};

export function ScenarioInput({
  name,
  label,
  money = false,
  defaultValue,
  optional = false,
  maximum,
  list,
}: {
  name: string;
  label: string;
  money?: boolean;
  defaultValue?: string | number;
  optional?: boolean;
  maximum?: number;
  list?: string;
}) {
  return (
    <FormField id={name} label={label} required={!optional}>
      {(props) =>
        money ? (
          <MoneyInput
            {...props}
            name={name}
            wholeToman
            defaultValue={defaultValue}
            required={!optional}
          />
        ) : (
          <Input
            {...props}
            name={name}
            dir="ltr"
            defaultValue={defaultValue}
            required={!optional}
            maxLength={maximum}
            list={list}
          />
        )
      }
    </FormField>
  );
}

export function parseScenarioAmount(value: string, label: string, max = 2_147_483_647) {
  const amount = parseAdminWholeToman(value);
  if (amount === null || !Number.isSafeInteger(amount) || amount < 0 || amount > max)
    throw new Error(`${label} را به صورت عدد صحیح غیرمنفی وارد کنید.`);
  return amount;
}

export function parseScenarioCount(value: string, label: string, max = 2_147_483_647) {
  if (!/^\d+$/.test(toAsciiDigits(value)))
    throw new Error(`${label} را به صورت عدد صحیح غیرمنفی وارد کنید.`);
  return parseScenarioAmount(value, label, max);
}

function readAmount(data: FormData, name: string, label: string, cap?: number) {
  return parseScenarioAmount(readReferralText(data, name), label, cap);
}

function readCount(data: FormData, name: string, label: string, cap?: number) {
  return parseScenarioCount(readReferralText(data, name), label, cap);
}

export function readBasketScenario(data: FormData) {
  const date = readCalendarValue(readReferralText(data, 'occurredAt'), 'date-time');
  if (!date) throw new Error('تاریخ و ساعت نمونه را وارد کنید.');
  const occurredAt = referralInstant(`${formatCalendarDay(date.day, 'gregory')}T${date.time}`);
  const rows = data.getAll('basketRow').map(String);
  const campaignId = readReferralText(data, 'campaignId');
  const referralVersion = readReferralText(data, 'referralVersion');
  const riskVersion = readReferralText(data, 'riskVersion');
  return {
    occurredAt,
    items: rows.map((row) => {
      const variantSku = readReferralText(data, `sku-${row}`);
      return {
        productSlug: readReferralText(data, `product-${row}`),
        ...(variantSku ? { variantSku } : {}),
        quantity: readCount(data, `quantity-${row}`, 'تعداد کالا', 100),
      };
    }),
    outcome: readReferralText(data, 'outcome'),
    previousCompletedPurchases: readCount(data, 'previous', 'تعداد خریدهای قبلی', 9999),
    shippingToman: readAmount(data, 'shipping', 'هزینهٔ ارسال'),
    availableCreditToman: readAmount(data, 'credit', 'ماندهٔ قابل مصرف'),
    ...(campaignId ? { campaignId } : {}),
    couponApplied: data.has('couponApplied'),
    hadPriorPaidOrder: data.has('hadPriorPaidOrder'),
    promotionPreviouslyRedeemed: data.has('promotionPreviouslyRedeemed'),
    usage: Object.fromEntries(
      Object.entries(usages).map(([key, label]) => [
        key,
        readAmount(data, key, label, Number.MAX_SAFE_INTEGER),
      ]),
    ),
    ...(referralVersion
      ? {
          referral: {
            version: parseScenarioCount(referralVersion, 'نسخهٔ سیاست معرفی'),
            ...(riskVersion
              ? { riskVersion: parseScenarioCount(riskVersion, 'نسخهٔ سیاست ریسک') }
              : {}),
            referrerHasPurchased: data.has('referrerPurchased'),
            delivered: data.has('delivered'),
            returnPending: data.has('returnPending'),
            referrerIncentivesToman: readAmount(
              data,
              'referrerIncentives',
              'مشوق‌های قبلی معرف',
              Number.MAX_SAFE_INTEGER,
            ),
            claimAgeDays: readCount(data, 'claimAge', 'گذشت روز از معرفی', 3650),
            programCommittedToman: readAmount(
              data,
              'referralCommitted',
              'تعهد قبلی معرفی',
              Number.MAX_SAFE_INTEGER,
            ),
            usage: data
              .getAll('usageRow')
              .map(String)
              .map((row) => ({
                ruleCode: readReferralText(data, `rule-${row}`),
                recipientUses: readCount(data, `uses-${row}`, 'دفعات مصرف', 10000),
                committedToman: readAmount(
                  data,
                  `committed-${row}`,
                  'تعهد قانون',
                  Number.MAX_SAFE_INTEGER,
                ),
              })),
            metrics: Object.entries(riskLabels).flatMap(([code, label]) => {
              const value = readReferralText(data, `risk-${code}`);
              return value ? [{ code, value: parseScenarioCount(value, label) }] : [];
            }),
          },
        }
      : {}),
  };
}

export function BasketScenarioFields() {
  const [items, setItems] = useState([0]);
  const [rules, setRules] = useState<number[]>([]);
  const nextItem = useRef(1);
  const nextRule = useRef(1);
  const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className="space-y-5">
      <div className={grid}>
        <DualCalendarPicker name="occurredAt" label="زمان نمونه به وقت تهران" required />
        <FormField id="outcome" label="نتیجهٔ فرضی سفارش">
          {(props) => (
            <Select
              {...props}
              name="outcome"
              defaultValue="PAID"
              options={[
                { value: 'PAID', label: 'پرداخت قطعی' },
                { value: 'UNPAID', label: 'در انتظار پرداخت' },
                { value: 'CANCELLED', label: 'لغوشده' },
                { value: 'FULLY_RETURNED', label: 'مرجوعی کامل' },
              ]}
            />
          )}
        </FormField>
        <ScenarioInput
          name="previous"
          label="تعداد خریدهای تکمیل‌شدهٔ قبلی"
          defaultValue="۰"
          maximum={4}
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-bold">اقلام سبد</legend>
        <p className="text-sm text-[var(--admin-color-muted)]">
          اسلاگ کالا را از انتهای نشانی آن بردارید. با خالی گذاشتن SKU، قیمت پیش‌فرض کالا محاسبه
          می‌شود.
        </p>
        {items.map((row, index) => (
          <div
            key={row}
            className="space-y-2 rounded-lg border border-[var(--admin-color-border)] p-3"
          >
            <input type="hidden" name="basketRow" value={row} />
            <div className={grid}>
              <ScenarioInput
                name={`product-${row}`}
                label={`اسلاگ کالای ${formatAdminInteger(index + 1)}`}
                maximum={220}
              />
              <ScenarioInput name={`sku-${row}`} label="SKU واریانت" maximum={100} optional />
              <ScenarioInput name={`quantity-${row}`} label="تعداد" defaultValue="۱" maximum={3} />
            </div>
            {items.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems(items.filter((id) => id !== row))}
              >
                حذف کالای {formatAdminInteger(index + 1)}
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= 20}
          onClick={() => {
            const id = nextItem.current++;
            setItems([...items, id]);
          }}
        >
          افزودن کالا
        </Button>
      </fieldset>
      <div className={grid}>
        <ScenarioInput name="shipping" label="هزینهٔ ارسال (تومان)" money defaultValue="۰" />
        <ScenarioInput name="credit" label="ماندهٔ قابل مصرف (تومان)" money defaultValue="۰" />
        <ScenarioInput name="campaignId" label="شناسهٔ کمپین" maximum={36} optional />
        <label className="flex items-center gap-2 text-sm">
          <input name="couponApplied" type="checkbox" /> سناریوی استفاده از کوپن کمپین
        </label>
      </div>
      <details className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3">
        <summary className="cursor-pointer font-semibold">مصرف قبلی سقف‌های مالی</summary>
        <div className={grid}>
          <label className="flex items-center gap-2 text-sm">
            <input name="hadPriorPaidOrder" type="checkbox" /> سابقهٔ پرداخت دارد، حتی اگر خرید کامل
            مرجوع شده است
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="promotionPreviouslyRedeemed" type="checkbox" /> خریدار قبلاً از این پیشنهاد
            استفاده کرده است
          </label>
          {Object.entries(usages).map(([key, label]) => (
            <ScenarioInput key={key} name={key} label={label + ' (تومان)'} money defaultValue="۰" />
          ))}
        </div>
      </details>
      <details className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3">
        <summary className="cursor-pointer font-semibold">معرفی و سیگنال‌های ریسک</summary>
        <p className="text-sm text-[var(--admin-color-muted)]">
          با وارد کردن نسخهٔ سیاست معرفی، اعتبار هر دو طرف محاسبه می‌شود. نسخهٔ خالی ریسک، آخرین
          سیاست ریسک را به کار می‌گیرد.
        </p>
        <div className={grid}>
          <ScenarioInput name="referralVersion" label="نسخهٔ سیاست معرفی" optional />
          <ScenarioInput name="riskVersion" label="نسخهٔ سیاست ریسک" optional />
          <ScenarioInput name="claimAge" label="روز گذشته از ثبت معرفی" defaultValue="۰" />
          <ScenarioInput
            name="referralCommitted"
            label="تعهد قبلی برنامهٔ معرفی (تومان)"
            money
            defaultValue="۰"
          />
          <ScenarioInput
            name="referrerIncentives"
            label="مشوق‌های قبلی معرف در دوره (تومان)"
            money
            defaultValue="۰"
          />
          <label className="flex items-center gap-2 text-sm">
            <input name="referrerPurchased" type="checkbox" /> معرف قبلاً خرید موفق داشته است
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="delivered" type="checkbox" /> سفارش به خریدار تحویل شده است
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="returnPending" type="checkbox" /> درخواست مرجوعی باز دارد
          </label>
        </div>
        {rules.map((id) => (
          <div key={id} className={grid}>
            <input type="hidden" name="usageRow" value={id} />
            <ScenarioInput name={`rule-${id}`} label="کد قانون معرفی" maximum={40} />
            <ScenarioInput name={`uses-${id}`} label="دفعات قبلی" defaultValue="۰" />
            <ScenarioInput
              name={`committed-${id}`}
              label="تعهد قبلی قانون (تومان)"
              money
              defaultValue="۰"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRules(rules.filter((rule) => rule !== id))}
            >
              حذف قانون نمونه
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rules.length >= 30}
          onClick={() => {
            const id = nextRule.current++;
            setRules([...rules, id]);
          }}
        >
          افزودن مصرف قبلی یک قانون
        </Button>
        <div className={grid}>
          {Object.entries(riskLabels).map(([code, label]) => (
            <ScenarioInput key={code} name={`risk-${code}`} label={label} optional />
          ))}
        </div>
      </details>
    </div>
  );
}
