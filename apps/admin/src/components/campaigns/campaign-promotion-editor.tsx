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
import { addCampaignSelection, useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import {
  formatAdminInteger,
  formatAdminToman,
  parseAdminMoneyInput,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import { CampaignPercentageOverrides, formatRateDrafts } from './campaign-percentage-overrides';
import { CampaignProductSearch } from './campaign-product-search';

type Rule = components['schemas']['SavePromotionDto'];
const labels: Record<Rule['kind'], string> = {
  PERCENT: 'درصدی',
  FIXED: 'مبلغ ثابت',
  THRESHOLD: 'مبلغ ثابت پس از حداقل خرید',
  BUNDLE: 'بستهٔ ترکیبی',
  FREE_SHIPPING: 'ارسال رایگان',
};

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const text = (field: string) => String(fields.get(field) ?? '').trim();
    const integer = (field: string) => {
      const value = toAsciiDigits(text(field));
      return /^\d+$/.test(value) ? Number(value) : NaN;
    };
    const money = (field: string) => parseAdminMoneyInput(text(field));
    const percentageOverrides =
      allowPercentageOverrides && kind === 'PERCENT'
        ? rates.map(({ productId, variantId, percentage }) => {
            const normalized = toAsciiDigits(percentage.trim()).replace('٫', '.');
            const rateBps = /^\d{1,2}(\.\d{1,2})?$/.test(normalized)
              ? Math.round(Number(normalized) * 100)
              : NaN;
            return { productId, variantId, rateBps };
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
    const draft: Rule = {
      kind,
      ...(percentageOverrides ? { percentageOverrides } : {}),
      value:
        kind === 'FREE_SHIPPING'
          ? 0
          : kind === 'PERCENT'
            ? integer('percentage') * 100
            : (money('amount') ?? 0),
      minSubtotalToman: money('minimum') ?? 0,
      maxDiscountToman: money('limit') ?? 0,
      maxDiscountBps: integer('percentCap') * 100,
      priority: integer('priority'),
      couponCode: text('coupon') || null,
      maxUses: text('uses') ? integer('uses') : null,
      bundleProductSlugs: kind === 'BUNDLE' ? bundle : [],
      expectedVersion: rule?.expectedVersion ?? 0,
    };
    if (kind === 'BUNDLE' && bundle.length < 2) {
      setError('حداقل دو محصول متمایز برای بسته انتخاب کنید.');
      return;
    }
    if (
      [draft.value, draft.maxDiscountBps, draft.priority, draft.maxUses ?? 1].some(
        (value) => !Number.isSafeInteger(value),
      )
    ) {
      setError('مقادیر عددی قانون را بررسی کنید.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/promotions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = payload?.error?.message;
        if (message === 'Set a campaign budget before configuring a promotion.')
          setError('ابتدا بودجهٔ کمپین را در پیش‌نویس ثبت کنید.');
        else if (message === 'This coupon is already in use.')
          setError('این کد تخفیف قبلاً برای کمپینی ثبت شده است.');
        else if (message === 'Choose active rate targets in the festival scope.')
          setError('نرخ اختصاصی را فقط برای محصول یا واریانت فعال در محدودهٔ جشنواره ثبت کنید.');
        else if (response.status === 409)
          setError('نسخه یا وضعیت کمپین تغییر کرده است. صفحه را تازه کنید.');
        else if (response.status === 400)
          setError('نوع قانون، سقف‌ها، تعداد استفاده و محدودهٔ محصول را بررسی کنید.');
        else setError('ذخیرهٔ قانون ممکن نشد.');
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
                    ? `${formatAdminInteger(rule.value / 100)}٪`
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
                {formatAdminInteger(rule.maxDiscountBps / 100)}٪
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
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
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
              hint="از ۱ تا ۵۰"
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="percentage"
                  inputMode="numeric"
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
                required
              >
                {(control) => (
                  <MoneyInput
                    {...control}
                    name="amount"
                    defaultValue={rule && rule.kind !== 'PERCENT' ? rule.value : ''}
                    required
                  />
                )}
              </FormField>
            )
          )}
          <FormField id="promotion-min" label="حداقل خرید کالا (تومان)">
            {(control) => (
              <MoneyInput {...control} name="minimum" defaultValue={rule?.minSubtotalToman ?? 0} />
            )}
          </FormField>
          <FormField id="promotion-limit" label="سقف مبلغ هر سفارش (تومان)" required>
            {(control) => (
              <MoneyInput
                {...control}
                name="limit"
                defaultValue={rule?.maxDiscountToman}
                required
              />
            )}
          </FormField>
          <FormField
            id="promotion-percent-limit"
            label="سقف درصد از مبلغ کالای واجد شرایط"
            hint={
              allowPercentageOverrides
                ? 'از ۱ تا ۵۰. این سقف روی مجموع تخفیف سفارش اعمال می‌شود.'
                : 'از ۱ تا ۵۰'
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                name="percentCap"
                inputMode="numeric"
                defaultValue={rule ? rule.maxDiscountBps / 100 : 20}
                required
              />
            )}
          </FormField>
          <FormField id="promotion-priority" label="اولویت میان کمپین‌ها" hint="از ۰ تا ۱۰۰">
            {(control) => (
              <Input
                {...control}
                name="priority"
                inputMode="numeric"
                defaultValue={rule?.priority ?? 0}
                required
              />
            )}
          </FormField>
          <FormField id="promotion-coupon" label="کد تخفیف" hint="برای اعمال خودکار خالی بگذارید.">
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
          <FormField id="promotion-uses" label="سقف تعداد استفاده" hint="برای کوپن الزامی است.">
            {(control) => (
              <Input
                {...control}
                name="uses"
                inputMode="numeric"
                defaultValue={rule?.maxUses ?? ''}
              />
            )}
          </FormField>
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
