import { useState } from 'react';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import {
  purchaseRanks,
  referralRecipients,
  rewardMethods,
  readReferralIds,
  readReferralNumber,
  readReferralPercent,
  readReferralText,
  referralInstant,
  referralCalendarValue,
  type ReferralRule,
} from '@/lib/reward-policies/referral-reward-policy';
import { ReferralScopeField } from './referral-scope-field';

export function NumberField({
  name,
  label,
  value,
  optional = false,
  money = false,
}: Readonly<{
  name: string;
  label: string;
  value: number | null | undefined;
  optional?: boolean;
  money?: boolean;
}>) {
  return (
    <FormField id={name} label={label} required={!optional}>
      {(props) =>
        money ? (
          <MoneyInput
            {...props}
            name={name}
            defaultValue={value ?? ''}
            wholeToman
            required={!optional}
          />
        ) : (
          <Input
            {...props}
            name={name}
            defaultValue={value ?? ''}
            inputMode="numeric"
            dir="ltr"
            required={!optional}
          />
        )
      }
    </FormField>
  );
}

export function DateField({
  name,
  label,
  value,
}: Readonly<{
  name: string;
  label: string;
  value?: string | null;
}>) {
  return (
    <DualCalendarPicker name={name} label={label} defaultValue={referralCalendarValue(value)} />
  );
}

export function Toggle({
  name,
  label,
  checked = false,
}: Readonly<{
  name: string;
  label: string;
  checked?: boolean;
}>) {
  return (
    <label className="flex min-h-8 items-center gap-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={checked} />
      {label}
    </label>
  );
}

function SelectField({
  name,
  label,
  value,
  options,
  onValueChange,
}: Readonly<{
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange?: (value: string) => void;
}>) {
  return (
    <FormField id={name} label={label} required>
      {(props) => (
        <Select
          {...props}
          name={name}
          defaultValue={value}
          onValueChange={onValueChange}
          required
          className="min-h-10 rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3 text-sm"
          options={options}
        />
      )}
    </FormField>
  );
}

export function ReferralRuleFields({
  index,
  rule,
}: Readonly<{ index: number; rule: ReferralRule }>) {
  const [recipient, setRecipient] = useState<string>(rule.recipient);
  const [method, setMethod] = useState<string>(rule.method);
  const key = `rule-${index}-`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id={`${key}code`} label="کد یکتای قانون" hint="حروف کوچک انگلیسی و عدد" required>
          {(props) => (
            <Input
              {...props}
              name={`${key}code`}
              defaultValue={rule.code}
              dir="ltr"
              pattern="[a-z0-9][a-z0-9_\-]{0,39}"
              maxLength={40}
              required
            />
          )}
        </FormField>
        <SelectField
          name={`${key}recipient`}
          label="دریافت‌کنندهٔ پاداش"
          value={rule.recipient}
          options={referralRecipients}
          onValueChange={setRecipient}
        />
        <SelectField
          name={`${key}rank`}
          label="مرتبهٔ خرید"
          value={rule.purchaseRank}
          options={purchaseRanks}
        />
        <SelectField
          name={`${key}method`}
          label="نوع پاداش"
          value={rule.method}
          options={rewardMethods}
          onValueChange={setMethod}
        />
        {method === 'PERCENT' ? (
          <FormField id={`${key}percent`} label="نرخ پاداش (درصد)" hint="برای نمونه ۲٫۵" required>
            {(props) => (
              <Input
                {...props}
                name={`${key}value`}
                inputMode="decimal"
                defaultValue={rule.method === 'PERCENT' ? rule.value / 100 : ''}
                required
              />
            )}
          </FormField>
        ) : (
          <NumberField
            name={`${key}value`}
            label="مبلغ ثابت پاداش (تومان)"
            value={rule.method === 'FIXED' ? rule.value : null}
            money
          />
        )}
        <NumberField name={`${key}priority`} label="اولویت (۰ تا ۱۰۰)" value={rule.priority} />
        <NumberField
          name={`${key}minimum`}
          label="حداقل مبلغ مشمول به تومان"
          value={rule.minimumToman}
          money
        />
        <NumberField
          name={`${key}maximum`}
          label="سقف بازه (تومان، خودِ سقف مشمول نیست)"
          value={rule.maximumExclusiveToman}
          optional
          money
        />
        <NumberField
          name={`${key}cap`}
          label="سقف پاداش هر خرید به تومان"
          value={rule.capToman}
          money
        />
        <NumberField
          name={`${key}uses`}
          label="حداکثر استفادهٔ هر دریافت‌کننده در ماه"
          value={rule.maxUsesPerRecipient}
        />
        <NumberField
          name={`${key}expiry`}
          label={
            recipient === 'REFERRED'
              ? 'مهلت استفاده از زمان ثبت کد به روز'
              : 'مهلت مصرف از زمان صدور پاداش به روز'
          }
          value={rule.expiryDays}
        />
        <NumberField
          name={`${key}budget`}
          label="بودجهٔ ماهانهٔ قانون به تومان"
          value={rule.periodBudgetToman}
          money
        />
        <DateField name={`${key}starts`} label="شروع اثر قانون" value={rule.startsAt} />
        <DateField name={`${key}ends`} label="پایان اثر قانون" value={rule.endsAt} />
      </div>
      <p className="text-sm">
        {recipient === 'REFERRED'
          ? 'اعتبار معرفی‌شونده در پرداخت خرید اول واجد شرایط اعمال می‌شود.'
          : 'پاداش معرف پس از تحویل خرید اول دوست و تأیید شرایط آن قابل صدور است.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReferralScopeField
          name={`${key}categories`}
          label="دسته‌های مجاز (خالی یعنی همه)"
          kind="category"
          values={rule.allowedCategoryIds}
        />
        <ReferralScopeField
          name={`${key}campaigns`}
          label="کمپین‌های مجاز (خالی یعنی بدون محدودیت)"
          kind="campaign"
          values={rule.campaignIds}
        />
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        <Toggle name={`${key}enabled`} label="قانون فعال باشد" checked={rule.enabled} />
        <Toggle
          name={`${key}allowCampaign`}
          label="ترکیب با کمپین مجاز باشد"
          checked={rule.allowCampaign}
        />
        <Toggle
          name={`${key}allowCoupon`}
          label="ترکیب با کد تخفیف مجاز باشد"
          checked={rule.allowCoupon}
        />
        <Toggle
          name={`${key}allowPurchaseReward`}
          label="ترکیب با پاداش خرید مجاز باشد"
          checked={rule.allowPurchaseReward}
        />
      </div>
    </div>
  );
}

export function readReferralRule(data: FormData, index: number): ReferralRule {
  const key = `rule-${index}-`;
  const text = (name: string) => readReferralText(data, `${key}${name}`);
  const amount = (name: string, label: string, max?: number) =>
    readReferralNumber(data, `${key}${name}`, label, max);
  const set = (name: string) => data.has(`${key}${name}`);
  const code = text('code');
  const recipient = referralRecipients.find((option) => option.value === text('recipient'))?.value;
  const purchaseRank = purchaseRanks.find((option) => option.value === text('rank'))?.value;
  const method = rewardMethods.find((option) => option.value === text('method'))?.value;
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(code) || !recipient || !purchaseRank || !method)
    throw new Error('کد، دریافت‌کننده، مرتبه و نوع پاداش را برای هر قانون مشخص کنید.');
  return {
    code,
    recipient,
    purchaseRank,
    method,
    enabled: set('enabled'),
    value:
      method === 'PERCENT'
        ? readReferralPercent(data, `${key}value`)
        : amount('value', 'مبلغ پاداش'),
    priority: amount('priority', 'اولویت', 100),
    minimumToman: amount('minimum', 'حداقل خرید'),
    maximumExclusiveToman: text('maximum') ? amount('maximum', 'مرز بالای پلکان') : null,
    capToman: amount('cap', 'سقف پاداش'),
    maxUsesPerRecipient: amount('uses', 'تعداد استفاده', 10_000),
    expiryDays: amount('expiry', 'مهلت مصرف', 3_650),
    periodBudgetToman: amount('budget', 'بودجهٔ قانون'),
    startsAt: referralInstant(text('starts')),
    endsAt: referralInstant(text('ends')),
    allowedCategoryIds: readReferralIds(data, `${key}categories`),
    campaignIds: readReferralIds(data, `${key}campaigns`),
    allowCampaign: set('allowCampaign'),
    allowCoupon: set('allowCoupon'),
    allowPurchaseReward: set('allowPurchaseReward'),
  };
}
