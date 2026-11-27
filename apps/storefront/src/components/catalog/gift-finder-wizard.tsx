'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  readGiftBudget,
  type GiftFinderChoices,
  type GiftFinderOptions,
  type GiftFinderResults,
} from '@/lib/catalog/gift-finder';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { cn } from '@/lib/ui/cn';

const steps = ['مناسبت و گیرنده', 'بودجه', 'سبک و نوع محصول'] as const;
const fields = {
  occasion: 'مناسبت',
  recipient: 'هدیه برای چه کسی است؟',
  style: 'سبک',
  category: 'نوع محصول',
} as const;
type Field = keyof typeof fields;
type Search =
  | { status: 'loading' | 'invalid' | 'error'; page: number }
  | { status: 'ready'; page: number; result: GiftFinderResults };

export function GiftFinderWizard({ options }: Readonly<{ options: GiftFinderOptions }>) {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<GiftFinderChoices>({});
  const [budget, setBudget] = useState('');
  const [budgetError, setBudgetError] = useState(false);
  const [search, setSearch] = useState<Search>();
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function edit(next: number) {
    request.current?.abort();
    setSearch(undefined);
    setStep(next);
    setBudgetError(false);
  }

  async function find(page: number) {
    const amount = readGiftBudget(budget);
    if (amount === null) {
      edit(1);
      setBudgetError(true);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (step === 3) heading.current?.focus();
    setSearch({ status: 'loading', page });
    setStep(3);
    try {
      const response = await fetch('/api/catalog/gift-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...choices, budget: amount, page }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 400) {
        setSearch({ status: 'invalid', page });
        return;
      }
      if (!response.ok) throw new Error('Gift finder results unavailable.');
      const result = (await response.json()) as GiftFinderResults;
      if (!controller.signal.aborted) setSearch({ status: 'ready', page, result });
    } catch {
      if (!controller.signal.aborted) setSearch({ status: 'error', page });
    }
  }

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1 && readGiftBudget(budget) === null) {
      setBudgetError(true);
      return;
    }
    if (step < 2) edit(step + 1);
    else void find(1);
  }

  function select(field: Field) {
    const available = options[field];
    return (
      <FormField
        key={field}
        id={`gift-${field}`}
        label={fields[field]}
        hint={
          available.length ? undefined : 'برای این بخش هنوز گزینه‌ای در محصولات موجود ثبت نشده است.'
        }
      >
        {(props) => (
          <select
            {...props}
            className="min-h-11 w-full rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border-strong)] bg-[var(--sf-color-canvas)] px-3 text-sm"
            disabled={!available.length}
            value={choices[field] ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setChoices((previous) => ({ ...previous, [field]: value || undefined }));
            }}
          >
            <option value="">تفاوتی ندارد</option>
            {available.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  }

  const budgetAmount = readGiftBudget(budget);
  const result = search?.status === 'ready' ? search.result : null;
  return (
    <div className="space-y-6">
      <ol aria-label="مراحل انتخاب هدیه" className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
        {steps.map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined}>
            <button
              type="button"
              disabled={index > step}
              onClick={() => edit(index)}
              className={cn(
                'h-full min-h-11 w-full rounded-[var(--sf-radius-md)] border px-2 py-2 text-start leading-5 disabled:opacity-60',
                step === index
                  ? 'border-[var(--sf-color-ink)] font-bold'
                  : 'border-[var(--sf-color-border)]',
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section
        aria-labelledby="gift-step-title"
        className="space-y-5 rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)] p-4 sm:p-6"
      >
        <h2
          id="gift-step-title"
          ref={heading}
          tabIndex={-1}
          className="text-xl font-bold leading-8"
        >
          {step < 3 ? steps[step] : 'پیشنهادهای هدیه'}
        </h2>
        {step < 3 ? (
          <form noValidate onSubmit={advance} className="space-y-6">
            {step === 1 ? (
              <FormField
                id="gift-budget"
                label="حداکثر بودجه (تومان)"
                required
                hint="بودجه برای قیمت کالا سنجیده می‌شود. هزینهٔ ارسال در پرداخت محاسبه می‌شود."
                error={
                  budgetError ? 'بودجه را به تومان و به‌صورت عدد صحیح معتبر وارد کنید.' : undefined
                }
              >
                {(props) => (
                  <Input
                    {...props}
                    inputMode="numeric"
                    value={budget}
                    maxLength={18}
                    onChange={(event) => {
                      setBudget(event.target.value);
                      setBudgetError(false);
                    }}
                    required
                  />
                )}
              </FormField>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {step === 0
                  ? [select('occasion'), select('recipient')]
                  : [select('style'), select('category')]}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => edit(step - 1)}>
                  مرحلهٔ قبل
                </Button>
              )}
              <Button type="submit">{step < 2 ? 'ادامه' : 'دیدن پیشنهادها'}</Button>
            </div>
          </form>
        ) : (
          <>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {budgetAmount !== null && (
                <div>
                  <dt className="text-xs text-[var(--sf-color-muted)]">حداکثر بودجه</dt>
                  <dd>{formatTomanPrice(budgetAmount)}</dd>
                </div>
              )}
              {Object.entries(fields).map(([field, label]) => {
                const key = field as Field;
                const chosen = options[key].find(({ value }) => value === choices[key]);
                return chosen ? (
                  <div key={key}>
                    <dt className="text-xs text-[var(--sf-color-muted)]">{label}</dt>
                    <dd>{chosen.label}</dd>
                  </div>
                ) : null;
              })}
            </dl>
            {search?.status === 'loading' && <p role="status">در حال بررسی قیمت و موجودی…</p>}
            {search?.status === 'invalid' && (
              <p role="alert">یکی از انتخاب‌ها دیگر معتبر نیست. ترجیحات را بررسی کنید.</p>
            )}
            {search?.status === 'error' && (
              <div className="space-y-3">
                <p role="alert">دریافت پیشنهادها انجام نشد.</p>
                <Button variant="outline" onClick={() => void find(search.page)}>
                  تلاش دوباره
                </Button>
              </div>
            )}
            {result?.items.length === 0 && (
              <p role="status" className="text-sm leading-7">
                {result.suggestedBudget ? (
                  <>
                    در این بودجه گزینه‌ای پیدا نشد. کمترین قیمتِ موجود با همین ترجیحات{' '}
                    {formatTomanPrice(result.suggestedBudget)} است.
                  </>
                ) : (
                  'برای این ترکیب محصولی با واریانت موجود و قیمت معتبر پیدا نشد. بودجه را افزایش دهید یا یکی از ترجیحات را بردارید.'
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (result?.suggestedBudget) setBudget(String(result.suggestedBudget));
                  edit(1);
                }}
              >
                {result?.suggestedBudget ? 'افزایش بودجه' : 'تغییر بودجه'}
              </Button>
              <Button variant="outline" onClick={() => edit(0)}>
                تغییر ترجیحات
              </Button>
            </div>
          </>
        )}
      </section>
      {!!result?.items.length && (
        <ul
          aria-label="محصولات پیشنهادی"
          className="grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-3 lg:grid-cols-4"
        >
          {result.items.map((product) => (
            <CatalogProductCard key={product.id} product={product} showBudgetMatch />
          ))}
        </ul>
      )}
      {search?.status === 'ready' && (search.page > 1 || search.result.totalPages > 1) && (
        <nav aria-label="صفحه‌بندی پیشنهادها" className="flex flex-wrap gap-2">
          {search.page > 1 && (
            <Button variant="outline" onClick={() => void find(search.page - 1)}>
              صفحهٔ قبل
            </Button>
          )}
          {search.page < search.result.totalPages && (
            <Button variant="outline" onClick={() => void find(search.page + 1)}>
              صفحهٔ بعد
            </Button>
          )}
        </nav>
      )}
      <ButtonLink href="/products" variant="text">
        مشاهدهٔ همهٔ محصولات
      </ButtonLink>
    </div>
  );
}
