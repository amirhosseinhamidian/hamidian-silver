'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import {
  ATTRIBUTE_SOURCE_LABELS,
  ATTRIBUTE_UNIT_LABELS,
  attributeValueFromText,
  attributeValueText,
  saveCatalogAttribute,
  type ProductAttributeChange,
  type ProductTypedAttribute,
} from '@/lib/catalog/catalog-attribute-model';
import { formatAdminInteger } from '@/lib/presentation/formatters';

function ProductAttributeForm({
  productId,
  item,
}: Readonly<{ productId: string; item: ProductTypedAttribute }>) {
  const router = useRouter();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { definition, value, revision, definitionVersion } = item;
  const legacyDefinition = value !== null && definitionVersion !== definition.version;
  const defaultValue = legacyDefinition ? '' : attributeValueText(value);

  async function save(input: ProductAttributeChange) {
    setError('');
    setBusy(true);
    try {
      await saveCatalogAttribute(
        `/api/catalog/products/${encodeURIComponent(productId)}/typed-attributes/${encodeURIComponent(definition.code)}`,
        'PATCH',
        { definitionVersion: definition.version, expectedRevision: revision, ...input },
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const legacyValue = String(form.get('legacyValue') ?? '').trim();
    if (legacyValue) {
      await save({ legacyValue });
      return;
    }
    try {
      const parsed = attributeValueFromText(String(form.get('value') ?? ''), definition);
      await save({ value: parsed });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'مقدار ویژگی معتبر نیست.');
    }
  }

  if (definition.source !== 'MANUAL') {
    return (
      <p className="text-sm">
        {definition.label} از بخش {ATTRIBUTE_SOURCE_LABELS[definition.source]} خوانده می‌شود.
      </p>
    );
  }
  const choices =
    definition.kind === 'SELECT'
      ? definition.options.map(({ code, label }) => ({ value: code, label }))
      : [
          { value: 'بله', label: 'بله' },
          { value: 'خیر', label: 'خیر' },
        ];
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-md border border-[var(--admin-color-border)] p-4"
    >
      <h3 className="font-bold">{definition.label}</h3>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {legacyDefinition ? (
        <Alert tone="warning">
          مقدار پیشین «{attributeValueText(value)}» در نسخهٔ{' '}
          {formatAdminInteger(definitionVersion ?? 0)} ثبت شده است. برای ثبت با تعریف تازه، مقدار را
          دوباره وارد کنید.
        </Alert>
      ) : null}
      <FormField
        id={`${id}-value`}
        label={`مقدار ${definition.label}`}
        hint={
          definition.kind === 'MULTI_SELECT'
            ? `کدها را با ویرگول جدا کنید. ${definition.options.map(({ code, label }) => `${label} (${code})`).join('، ')}`
            : definition.kind === 'RANGE'
              ? `بازه به شکل ۱۰..۲۰. واحد ${ATTRIBUTE_UNIT_LABELS[definition.unit]}`
              : definition.kind === 'NUMBER'
                ? ATTRIBUTE_UNIT_LABELS[definition.unit]
                : undefined
        }
      >
        {(props) =>
          definition.kind === 'SELECT' || definition.kind === 'BOOLEAN' ? (
            <Select
              {...props}
              name="value"
              defaultValue={defaultValue || undefined}
              options={choices}
            />
          ) : (
            <Input
              {...props}
              name="value"
              defaultValue={defaultValue}
              inputMode={definition.kind === 'NUMBER' ? 'decimal' : 'text'}
            />
          )
        }
      </FormField>
      {definition.legacyMappings.length > 0 ? (
        <FormField
          id={`${id}-legacy`}
          label="اعمال نگاشت مقدار قدیمی"
          hint="اگر این فیلد را پر کنید، نگاشت تأییدشدهٔ همان متن ذخیره می‌شود."
        >
          {(props) => <Input {...props} name="legacyValue" maxLength={500} />}
        </FormField>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" loading={busy}>
          ذخیرهٔ مقدار
        </Button>
        {value !== null ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save({ clear: true })}
          >
            پاک کردن مقدار
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ProductTypedAttributes({
  productId,
  items,
  failed,
}: Readonly<{
  productId: string;
  items: readonly ProductTypedAttribute[];
  failed: boolean;
}>) {
  return (
    <section id="typed-attributes" className="scroll-mt-6">
      <Card title="ویژگی‌های ساختاریافتهٔ محصول" className="mt-6">
        {failed ? (
          <Alert tone="danger">دریافت ویژگی‌های ساختاریافته انجام نشد.</Alert>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--admin-color-muted)]">
            برای دسته‌های این محصول ویژگی فعالی ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-4">
            {items.some(({ needsCompletion }) => needsCompletion) ? (
              <Alert tone="warning">
                ویژگی‌های نیازمند تکمیل این محصول{' '}
                {items
                  .filter(({ needsCompletion }) => needsCompletion)
                  .map(({ definition }) => definition.label)
                  .join('، ')}
              </Alert>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <ProductAttributeForm
                  key={`${item.definition.code}:${item.definition.version}:${item.revision}`}
                  productId={productId}
                  item={item}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
