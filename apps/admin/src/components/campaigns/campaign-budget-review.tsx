'use client';

import type { components } from '@hamidian/contracts';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { campaignError, campaignMessage } from '@/lib/campaigns/campaign-api-errors';
import { campaignAudienceLabels, type CampaignDetail } from '@/lib/campaigns/campaign-model';
import {
  formatAdminInteger,
  formatAdminToman,
  parseAdminMoneyInput,
  toAsciiDigits,
} from '@/lib/presentation/formatters';

import { CampaignProductSearch } from './campaign-product-search';

type Sample = components['schemas']['CampaignSimulationDto'];
type SampleInput = components['schemas']['CampaignSimulationInputDto'];
const maxBasketLines = 10;
const maxToman = 2_147_483_647;

export function CampaignBudgetReview({
  campaign,
  rule,
}: {
  campaign: CampaignDetail;
  rule: components['schemas']['SavePromotionDto'] | null;
}) {
  const { budget } = campaign;
  const [selected, setSelected] = useState(() =>
    rule?.bundleProductSlugs.length ? rule.bundleProductSlugs : campaign.productSlugs.slice(0, 1),
  );
  const [sample, setSample] = useState<Sample | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const money = (field: string) => parseAdminMoneyInput(String(fields.get(field) ?? ''));
    const items = selected.map((slug, index) => {
      const quantity = toAsciiDigits(String(fields.get(`quantity-${index}`) ?? ''));
      return {
        slug,
        quantity: /^\d{1,3}$/.test(quantity) ? Number(quantity) : 0,
        unitSalePriceToman: money(`price-${index}`) ?? 0,
      };
    });
    const shippingToman = money('shipping') ?? 0;
    setSample(null);
    if (
      !items.length ||
      shippingToman +
        items.reduce((total, line) => total + line.quantity * line.unitSalePriceToman, 0) >
        maxToman ||
      items.some(
        ({ quantity, unitSalePriceToman }) =>
          quantity < 1 || quantity > 100 || unitSalePriceToman < 1,
      )
    ) {
      setError('تعداد هر محصول، قیمت واحد و جمع سبد نمونه را بررسی کنید.');
      return;
    }
    const body: SampleInput = {
      expectedRevision: campaign.revision,
      hasPaidOrder: fields.get('hasPaidOrder') === 'on',
      items,
      shippingToman,
    };
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        return;
      }
      setSample((await response.json()) as Sample);
    } catch {
      setError('محاسبهٔ سبد نمونه ممکن نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="بودجه و پیش‌نمایش تخفیف">
      <div className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {campaign.managementPurpose !== 'SALES' && (
            <div>
              <dt>هزینهٔ برنامه‌ریزی‌شدهٔ کانال</dt>
              <dd>
                {campaign.plannedChannelCostToman === null
                  ? 'ثبت نشده'
                  : formatAdminToman(campaign.plannedChannelCostToman)}
              </dd>
            </div>
          )}
          <div>
            <dt>سقف تخفیف</dt>
            <dd>{formatAdminToman(budget.discountBudgetToman)}</dd>
          </div>
          <div>
            <dt>تخفیف تعهدشدهٔ سفارش‌ها</dt>
            <dd>{formatAdminToman(budget.committedDiscountToman)}</dd>
          </div>
          {'committedReferralRewardToman' in budget &&
            typeof budget.committedReferralRewardToman === 'number' && (
              <div>
                <dt>پاداش معرف صادرشده</dt>
                <dd>{formatAdminToman(budget.committedReferralRewardToman)}</dd>
              </div>
            )}
          <div>
            <dt>بودجهٔ باقی‌ماندهٔ تخفیف</dt>
            <dd>{formatAdminToman(budget.remainingDiscountToman)}</dd>
          </div>
          <div>
            <dt>دفعات استفاده</dt>
            <dd>
              {formatAdminInteger(budget.usedOrders)} ثبت‌شده
              {budget.remainingUses === null
                ? ''
                : `، ${formatAdminInteger(budget.remainingUses)} باقی‌مانده`}
            </dd>
          </div>
          <div>
            <dt>مخاطب تخفیف</dt>
            <dd>{campaignAudienceLabels[campaign.audience]}</dd>
          </div>
        </dl>
        {budget.blockers.map((message) => (
          <Alert key={message} tone="danger">
            {campaignMessage(message, 'قواعد کمپین را بررسی کنید.')}
          </Alert>
        ))}
        {budget.warnings.map((message) => (
          <Alert key={message} tone="warning">
            {campaignMessage(message, 'سقف‌های کمپین را بررسی کنید.')}
          </Alert>
        ))}
        {rule && (
          <form onSubmit={(event) => void preview(event)} onChange={() => setSample(null)}>
            <fieldset
              disabled={pending}
              className="space-y-4 border-t border-[var(--admin-color-border)] pt-4"
            >
              <p className="text-sm">
                قیمت و هزینهٔ ارسال نمونه را وارد کنید. برآورد بر اساس قانون ذخیره‌شده و{' '}
                {rule.couponCode ? 'با فرض ورود کوپن معتبر' : 'تخفیف خودکار'} محاسبه می‌شود.
              </p>
              {Boolean(rule.percentageOverrides?.length) && (
                <p className="text-sm text-[var(--admin-color-muted)]">
                  سبد نمونه نرخ سطح محصول را به کار می‌برد. نرخ هر واریانت در پیش‌نمایش قیمت مرحلهٔ
                  قوانین فروش قابل مشاهده است.
                </p>
              )}
              {selected.map((slug, index) => (
                <fieldset key={slug} className="grid items-start gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <legend className="text-sm font-semibold">
                    <bdi>{slug}</bdi>
                  </legend>
                  <FormField id={`basket-quantity-${index}`} label="تعداد" required>
                    {(props) => (
                      <Input
                        {...props}
                        name={`quantity-${index}`}
                        defaultValue="۱"
                        inputMode="numeric"
                        maxLength={3}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id={`basket-price-${index}`} label="قیمت واحد نمونه (تومان)" required>
                    {(props) => <MoneyInput {...props} name={`price-${index}`} required />}
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    className="sm:mt-6"
                    aria-label={`حذف ${slug}`}
                    onClick={() => {
                      setSelected((current) => current.filter((item) => item !== slug));
                      setSample(null);
                    }}
                  >
                    حذف
                  </Button>
                </fieldset>
              ))}
              <CampaignProductSearch
                selected={selected}
                disabled={pending || selected.length >= maxBasketLines}
                onSelect={(slug) => {
                  setSelected((current) => [...current, slug]);
                  setSample(null);
                }}
              />
              <FormField id="basket-shipping" label="هزینهٔ ارسال نمونه (تومان)">
                {(props) => <MoneyInput {...props} name="shipping" defaultValue={0} />}
              </FormField>
              {campaign.audience !== 'ALL_CUSTOMERS' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="hasPaidOrder"
                    defaultChecked={campaign.audience === 'RETURNING'}
                  />
                  مشتری نمونه قبلاً سفارش پرداخت‌شده دارد
                </label>
              )}
              <Button type="submit" loading={pending} disabled={selected.length === 0}>
                محاسبهٔ سبد نمونه
              </Button>
            </fieldset>
          </form>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {sample && (
          <div className="space-y-3 text-sm" aria-live="polite">
            {sample.reason && (
              <Alert tone="info">{campaignMessage(sample.reason, 'تخفیف اعمال نشد.')}</Alert>
            )}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt>جمع کالا</dt>
                <dd>{formatAdminToman(sample.merchandiseToman)}</dd>
              </div>
              <div>
                <dt>جمع کالای واجد شرایط</dt>
                <dd>{formatAdminToman(sample.eligibleSubtotalToman)}</dd>
              </div>
              <div>
                <dt>ارسال پیش از تخفیف</dt>
                <dd>{formatAdminToman(sample.shippingToman)}</dd>
              </div>
              <div>
                <dt>تخفیف کالا</dt>
                <dd>{formatAdminToman(sample.merchandiseDiscountToman)}</dd>
              </div>
              <div>
                <dt>تخفیف ارسال</dt>
                <dd>{formatAdminToman(sample.shippingDiscountToman)}</dd>
              </div>
              <div>
                <dt>پرداختی نمونه</dt>
                <dd className="font-bold">{formatAdminToman(sample.payableToman)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Card>
  );
}
