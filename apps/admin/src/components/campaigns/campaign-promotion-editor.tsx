'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { campaignFormError } from '@/lib/campaigns/campaign-api-errors';
import {
  campaignIntMax,
  focusCampaignField,
  type CampaignFieldError,
} from '@/lib/campaigns/campaign-form';
import { addCampaignSelection, useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import {
  formatAdminInteger,
  formatAdminToman,
  parseAdminWholeToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import { CampaignPercentageOverrides, formatRateDrafts } from './campaign-percentage-overrides';
import { CampaignProductSearch } from './campaign-product-search';

type Rule = components['schemas']['SavePromotionDto'];
const percentageFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const labels: Record<Rule['kind'], string> = {
  PERCENT: 'درصدی',
  FIXED: 'مبلغ ثابت',
  THRESHOLD: 'مبلغ ثابت پس از حداقل خرید',
  BUNDLE: 'بستهٔ ترکیبی',
  FREE_SHIPPING: 'ارسال رایگان',
};
const promotionServerFields = {
  'This coupon is already in use.': {
    field: 'coupon',
    message: 'این کد تخفیف قبلاً برای کمپینی ثبت شده است.',
  },
  'Enter a valid coupon code.': {
    field: 'coupon',
    message:
      'برای کد تخفیف از ۲ تا ۳۲ حرف لاتین، عدد یا خط تیره استفاده کنید. کد باید با حرف یا عدد آغاز شود.',
  },
  'A coupon needs a redemption limit.': {
    field: 'uses',
    message: 'برای کد تخفیف، سقف تعداد استفاده را تعیین کنید.',
  },
} satisfies Record<string, CampaignFieldError>;

function percentageBps(text: string) {
  const value = toAsciiDigits(text.trim()).replace('٫', '.');
  return /^\d{1,2}(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : NaN;
}

export function CampaignPromotionEditor({
  id,
  rule,
  editable,
  allowPercentageOverrides,
  rateTargets = [],
}: {
  id: string;
  rule: Rule | null;
  editable: boolean;
  allowPercentageOverrides: boolean;
  rateTargets?: components['schemas']['PromotionRateTargetDto'][];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Rule['kind']>(rule?.kind ?? 'PERCENT');
  const [bundle, setBundle] = useState(rule?.bundleProductSlugs ?? []);
  const [rates, setRates] = useState(() =>
    formatRateDrafts(rule?.percentageOverrides ?? [], rateTargets),
  );
  const taxonomy = useCampaignTaxonomy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<CampaignFieldError | null>(null);
  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(null);
    setFieldError(null);
    function invalid(issue: CampaignFieldError) {
      setFieldError(issue);
      focusCampaignField(form, issue.field);
    }
    const text = (field: string) => String(fields.get(field) ?? '').trim();
    const integer = (field: string) => {
      const value = toAsciiDigits(text(field));
      return /^\d+$/.test(value) ? Number(value) : NaN;
    };
    const money = (field: string) => parseAdminWholeToman(text(field));
    const percentageOverrides =
      allowPercentageOverrides && kind === 'PERCENT'
        ? rates.map(({ productId, variantId, percentage }) => {
            return { productId, variantId, rateBps: percentageBps(percentage) };
          })
        : undefined;
    if (
      percentageOverrides?.some(
        ({ rateBps }) => !Number.isInteger(rateBps) || rateBps < 100 || rateBps > 5_000,
      )
    ) {
      setError('نرخ اختصاصی باید بین ۱ و ۵۰ درصد و حداکثر دارای دو رقم اعشار باشد.');
      return;
    }
    const value =
      kind === 'FREE_SHIPPING'
        ? 0
        : kind === 'PERCENT'
          ? percentageBps(text('percentage'))
          : money('amount');
    const minimum = text('minimum') ? money('minimum') : 0;
    const limit = money('limit');
    const percentCap = percentageBps(text('percentCap'));
    const priority = text('priority') ? integer('priority') : 0;
    const couponCode = text('coupon').toUpperCase() || null;
    const maxUses = text('uses') ? integer('uses') : null;
    if (kind === 'PERCENT' && (!value || value > 5_000))
      return invalid({
        field: 'percentage',
        message: 'درصد را بین ۰٫۰۱ تا ۵۰ با حداکثر دو رقم اعشار وارد کنید.',
      });
    if (kind !== 'PERCENT' && kind !== 'FREE_SHIPPING' && (!value || value > campaignIntMax))
      return invalid({
        field: 'amount',
        message: 'مبلغ تخفیف را به تومان و به‌صورت عدد صحیح مثبت وارد کنید.',
      });
    if (minimum === null || minimum > campaignIntMax || (kind === 'THRESHOLD' && minimum === 0))
      return invalid({
        field: 'minimum',
        message:
          kind === 'THRESHOLD'
            ? 'برای این نوع تخفیف، حداقل خرید مثبت و به تومان لازم است.'
            : 'حداقل خرید را به تومان و به‌صورت عدد صحیح وارد کنید.',
      });
    if (limit === null || limit < 1 || limit > campaignIntMax)
      return invalid({
        field: 'limit',
        message: 'سقف تخفیف هر سفارش را به تومان و به‌صورت عدد صحیح مثبت وارد کنید.',
      });
    if (!percentCap || percentCap > 5_000)
      return invalid({
        field: 'percentCap',
        message: 'سقف درصد را بین ۰٫۰۱ تا ۵۰ با حداکثر دو رقم اعشار وارد کنید.',
      });
    if (!Number.isInteger(priority) || priority < 0 || priority > 100)
      return invalid({ field: 'priority', message: 'اولویت باید عدد صحیح بین ۰ تا ۱۰۰ باشد.' });
    if (couponCode && !/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(couponCode))
      return invalid(promotionServerFields['Enter a valid coupon code.']);
    if (couponCode && maxUses === null)
      return invalid(promotionServerFields['A coupon needs a redemption limit.']);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000))
      return invalid({
        field: 'uses',
        message: 'تعداد استفاده باید عدد صحیح بین ۱ و ۱٬۰۰۰٬۰۰۰ باشد.',
      });

    const draft: Rule = {
      kind,
      ...(percentageOverrides ? { percentageOverrides } : {}),
      value: value ?? 0,
      minSubtotalToman: minimum,
      maxDiscountToman: limit,
      maxDiscountBps: percentCap,
      priority,
      couponCode,
      maxUses,
      bundleProductSlugs: kind === 'BUNDLE' ? bundle : [],
      expectedVersion: rule?.expectedVersion ?? 0,
    };
    if (kind === 'BUNDLE' && bundle.length < 2) {
      setError('حداقل دو محصول متمایز برای بسته انتخاب کنید.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const issue = await campaignFormError(response, promotionServerFields);
        if (typeof issue === 'string') setError(issue);
        else invalid(issue);
        return;
      }
      router.refresh();
    } catch {
      setError('ارتباط برای ذخیرهٔ قانون برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    return (
      <Card title="قانون تخفیف">
        {rule ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt>نوع قانون</dt>
              <dd>{labels[rule.kind]}</dd>
            </div>
            {rule.kind !== 'FREE_SHIPPING' && (
              <div>
                <dt>
                  {allowPercentageOverrides && rule.kind === 'PERCENT' ? 'درصد پیش‌فرض' : 'مقدار'}
                </dt>
                <dd>
                  {rule.kind === 'PERCENT'
                    ? `${percentageFormatter.format(rule.value / 100)}٪`
                    : formatAdminToman(rule.value)}
                </dd>
              </div>
            )}
            {allowPercentageOverrides && rule.kind === 'PERCENT' && rates.length > 0 && (
              <div className="sm:col-span-2">
                <dt>درصدهای اختصاصی</dt>
                <dd>
                  <ul className="space-y-1">
                    {rates.map(
                      ({ productId, variantId, productName, variantLabel, percentage }) => (
                        <li key={variantId ?? productId}>
                          {productName} · {variantLabel ?? 'محصول'} ·{' '}
                          {toPersianDigits(percentage.replace('.', '٫'))}٪
                        </li>
                      ),
                    )}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt>سقف هر سفارش</dt>
              <dd>
                {formatAdminToman(rule.maxDiscountToman)} ·{' '}
                {percentageFormatter.format(rule.maxDiscountBps / 100)}٪
              </dd>
            </div>
            <div>
              <dt>حداقل خرید</dt>
              <dd>{formatAdminToman(rule.minSubtotalToman)}</dd>
            </div>
            {rule.couponCode && (
              <div>
                <dt>کد</dt>
                <dd>
                  <bdi>{rule.couponCode}</bdi>
                </dd>
              </div>
            )}
            {rule.maxUses && (
              <div>
                <dt>سقف استفاده</dt>
                <dd>{formatAdminInteger(rule.maxUses)}</dd>
              </div>
            )}
            {rule.bundleProductSlugs.length > 0 && (
              <div>
                <dt>محصولات بسته</dt>
                <dd className="break-all">{rule.bundleProductSlugs.join('، ')}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm">قانون تخفیفی برای این کمپین ثبت نشده است.</p>
        )}
      </Card>
    );
  }

  return (
    <Card title="قانون تخفیف" description="این قانون پس از تأیید و انتشار کمپین قابل اعمال است.">
      <form className="space-y-4" onSubmit={(event) => void save(event)} noValidate>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <FormField id="promotion-kind" label="نوع تخفیف">
            {(control) => (
              <Select
                {...control}
                value={kind}
                disabled={busy}
                onValueChange={(value) => setKind(value as Rule['kind'])}
                options={Object.entries(labels).map(([value, label]) => ({ value, label }))}
              />
            )}
          </FormField>
          {kind === 'PERCENT' ? (
            <FormField
              id="promotion-percent"
              label={allowPercentageOverrides ? 'درصد تخفیف پیش‌فرض' : 'درصد تخفیف'}
              hint="از ۰٫۰۱ تا ۵۰ درصد، با حداکثر دو رقم اعشار."
              error={errorFor('percentage')}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="percentage"
                  inputMode="decimal"
                  defaultValue={rule?.kind === 'PERCENT' ? rule.value / 100 : 10}
                  required
                />
              )}
            </FormField>
          ) : (
            kind !== 'FREE_SHIPPING' && (
              <FormField
                id="promotion-amount"
                label={kind === 'BUNDLE' ? 'تخفیف هر بسته (تومان)' : 'مبلغ تخفیف (تومان)'}
                hint="مبلغ باید بیشتر از صفر باشد."
                error={errorFor('amount')}
                required
              >
                {(control) => (
                  <MoneyInput
                    {...control}
                    name="amount"
                    wholeToman
                    defaultValue={rule && rule.kind !== 'PERCENT' ? rule.value : ''}
                    required
                  />
                )}
              </FormField>
            )
          )}
          <FormField
            id="promotion-min"
            label="حداقل خرید کالا (تومان)"
            hint={
              kind === 'THRESHOLD'
                ? 'حداقل مبلغ لازم برای اعمال این تخفیف.'
                : 'صفر یا خالی یعنی شرط حداقل خرید اعمال نمی‌شود.'
            }
            error={errorFor('minimum')}
            required={kind === 'THRESHOLD'}
          >
            {(control) => (
              <MoneyInput
                {...control}
                name="minimum"
                wholeToman
                defaultValue={rule?.minSubtotalToman ?? 0}
              />
            )}
          </FormField>
          <FormField
            id="promotion-limit"
            label="سقف مبلغ هر سفارش (تومان)"
            hint="حداکثر تخفیف این قانون در یک سفارش. مقدار مثبت وارد کنید."
            error={errorFor('limit')}
            required
          >
            {(control) => (
              <MoneyInput
                {...control}
                name="limit"
                wholeToman
                defaultValue={rule?.maxDiscountToman}
                required
              />
            )}
          </FormField>
          <FormField
            id="promotion-percent-limit"
            label="سقف درصد از مبلغ کالای واجد شرایط"
            hint="از ۰٫۰۱ تا ۵۰ درصد. سقف نهایی از مبلغ کالای واجد شرایط محاسبه می‌شود."
            error={errorFor('percentCap')}
            required
          >
            {(control) => (
              <Input
                {...control}
                name="percentCap"
                inputMode="decimal"
                defaultValue={rule ? rule.maxDiscountBps / 100 : 20}
                required
              />
            )}
          </FormField>
          <FormField
            id="promotion-coupon"
            label="کد تخفیف"
            hint="مانند NOROUZ20. برای اعمال خودکار خالی بگذارید."
            error={errorFor('coupon')}
          >
            {(control) => (
              <Input
                {...control}
                name="coupon"
                dir="ltr"
                maxLength={32}
                defaultValue={rule?.couponCode ?? ''}
              />
            )}
          </FormField>
          <FormField
            id="promotion-uses"
            label="سقف تعداد استفاده"
            hint="از ۱ تا ۱٬۰۰۰٬۰۰۰. خالی یعنی بدون سقف تعداد و فقط برای قانون بدون کوپن مجاز است."
            error={errorFor('uses')}
          >
            {(control) => (
              <Input
                {...control}
                name="uses"
                inputMode="numeric"
                defaultValue={rule?.maxUses ?? ''}
              />
            )}
          </FormField>
          <details className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3 sm:col-span-2">
            <summary className="cursor-pointer text-sm font-semibold">تنظیمات پیشرفته</summary>
            <FormField
              id="promotion-priority"
              label="اولویت میان کمپین‌ها"
              hint="از ۰ تا ۱۰۰. مقدار خالی برابر صفر است."
              error={errorFor('priority')}
            >
              {(control) => (
                <Input
                  {...control}
                  name="priority"
                  inputMode="numeric"
                  defaultValue={rule?.priority ?? 0}
                />
              )}
            </FormField>
          </details>
          {allowPercentageOverrides && kind === 'PERCENT' && (
            <CampaignPercentageOverrides
              campaignId={id}
              taxonomy={taxonomy.data}
              rates={rates}
              onChange={setRates}
              disabled={busy}
            />
          )}
          {kind === 'BUNDLE' && (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-xs text-[var(--admin-color-muted)]">
                حداقل دو محصول متمایز از محدودهٔ کمپین انتخاب کنید.
              </p>
              <CampaignProductSearch
                selected={bundle}
                campaignId={id}
                withinCampaign
                taxonomy={taxonomy.data}
                max={10}
                disabled={busy}
                onSelect={(slug) => setBundle((current) => addCampaignSelection(current, slug, 10))}
                onRemove={(slug) => setBundle((current) => current.filter((item) => item !== slug))}
              />
            </div>
          )}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" loading={busy}>
          ذخیرهٔ قانون تخفیف
        </Button>
      </form>
    </Card>
  );
}
