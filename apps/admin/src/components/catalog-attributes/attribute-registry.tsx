'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import {
  ATTRIBUTE_KIND_LABELS,
  ATTRIBUTE_SOURCE_LABELS,
  ATTRIBUTE_UNIT_LABELS,
  attributeValueFromText,
  attributeValueText,
  parseAttributePairs,
  saveCatalogAttribute,
  type AttributeConfig,
  type AttributeDefinition,
} from '@/lib/catalog/catalog-attribute-model';
import type { AdminCategory } from '@/lib/catalog/catalog-model';
import { formatAdminInteger, toAsciiDigits } from '@/lib/presentation/formatters';

const asOptions = (labels: Readonly<Record<string, string>>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

function AttributeEditor({
  definition,
  categories,
}: Readonly<{ definition?: AttributeDefinition; categories: readonly AdminCategory[] }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = (key: string) => String(form.get(key) ?? '');
    try {
      const kind = text('kind') as AttributeConfig['kind'];
      const unit = text('unit') as AttributeConfig['unit'];
      const source = text('source') as AttributeConfig['source'];
      const categoryIds = categories
        .filter(({ id }) => text(`scope-${id}`) === 'include')
        .map(({ id }) => id);
      const excludedCategoryIds = categories
        .filter(({ id }) => text(`scope-${id}`) === 'exclude')
        .map(({ id }) => id);
      const config: AttributeConfig = {
        label: text('label').trim(),
        kind,
        unit,
        source,
        isActive: form.has('isActive'),
        sortOrder: Number(toAsciiDigits(text('sortOrder'))),
        categoryIds,
        excludedCategoryIds,
        options: parseAttributePairs(text('options')).map(([code, label]) => ({ code, label })),
        legacyMappings: parseAttributePairs(text('legacyMappings')).map(([legacyValue, value]) => ({
          legacyValue,
          value: attributeValueFromText(value, { kind, unit }),
        })),
      };
      setBusy(true);
      if (definition) {
        await saveCatalogAttribute(
          `/api/catalog/attribute-definitions/${encodeURIComponent(definition.code)}`,
          'PATCH',
          { ...config, expectedVersion: definition.version },
        );
      } else {
        await saveCatalogAttribute('/api/catalog/attribute-definitions', 'POST', {
          ...config,
          code: text('code').trim(),
        });
        formElement.reset();
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="attribute-code" label="کد ثابت ویژگی" required>
          {(props) => (
            <Input
              {...props}
              name="code"
              dir="ltr"
              defaultValue={definition?.code}
              readOnly={Boolean(definition)}
              maxLength={64}
              required
            />
          )}
        </FormField>
        <FormField id="attribute-label" label="نام نمایشی" required>
          {(props) => (
            <Input
              {...props}
              name="label"
              defaultValue={definition?.label}
              maxLength={100}
              required
            />
          )}
        </FormField>
        <FormField id="attribute-kind" label="نوع مقدار" required>
          {(props) => (
            <Select
              {...props}
              name="kind"
              defaultValue={definition?.kind ?? 'SELECT'}
              options={asOptions(ATTRIBUTE_KIND_LABELS)}
            />
          )}
        </FormField>
        <FormField id="attribute-unit" label="واحد" required>
          {(props) => (
            <Select
              {...props}
              name="unit"
              defaultValue={definition?.unit ?? 'NONE'}
              options={asOptions(ATTRIBUTE_UNIT_LABELS)}
            />
          )}
        </FormField>
        <FormField id="attribute-source" label="منبع مقدار" required>
          {(props) => (
            <Select
              {...props}
              name="source"
              defaultValue={definition?.source ?? 'MANUAL'}
              options={asOptions(ATTRIBUTE_SOURCE_LABELS)}
            />
          )}
        </FormField>
        <FormField id="attribute-sort-order" label="ترتیب نمایش" required>
          {(props) => (
            <Input
              {...props}
              name="sortOrder"
              type="number"
              min={0}
              max={10000}
              defaultValue={definition?.sortOrder ?? 0}
              required
            />
          )}
        </FormField>
      </div>
      <Checkbox
        id="attribute-enabled"
        name="isActive"
        label="ویژگی فعال باشد"
        defaultChecked={definition?.isActive ?? true}
      />

      <fieldset className="grid gap-3 border-t border-[var(--admin-color-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="text-sm font-bold">دامنهٔ دسته‌ها</legend>
        {categories.map(({ id, name, slug }) => (
          <FormField key={id} id={`attribute-scope-${id}`} label={`${name} (${slug})`}>
            {(props) => (
              <Select
                {...props}
                name={`scope-${id}`}
                defaultValue={
                  definition?.categoryIds.includes(id)
                    ? 'include'
                    : definition?.excludedCategoryIds.includes(id)
                      ? 'exclude'
                      : 'inherit'
                }
                options={[
                  { value: 'inherit', label: 'ارث‌بری از والد' },
                  { value: 'include', label: 'فعال برای این شاخه' },
                  { value: 'exclude', label: 'غیرفعال برای این شاخه' },
                ]}
              />
            )}
          </FormField>
        ))}
      </fieldset>
      <FormField
        id="attribute-options"
        label="گزینه‌های مجاز"
        hint="برای ویژگی انتخابی، هر سطر یک کد و نام نمایشی با جداکنندهٔ | وارد کنید."
      >
        {(props) => (
          <Textarea
            {...props}
            name="options"
            rows={4}
            defaultValue={definition?.options
              .map(({ code, label }) => `${code} | ${label}`)
              .join('\n')}
          />
        )}
      </FormField>
      <FormField
        id="attribute-mappings"
        label="نگاشت مقادیر متنی پیشین"
        hint="هر سطر متن قدیمی | مقدار معتبر. برای چندانتخابی کدها را با ویرگول و برای بازه دو عدد را با .. جدا کنید."
      >
        {(props) => (
          <Textarea
            {...props}
            name="legacyMappings"
            rows={4}
            defaultValue={definition?.legacyMappings
              .map(({ legacyValue, value }) => `${legacyValue} | ${attributeValueText(value)}`)
              .join('\n')}
          />
        )}
      </FormField>
      <Button type="submit" loading={busy}>
        {definition ? 'ذخیرهٔ نسخهٔ جدید' : 'ایجاد ویژگی'}
      </Button>
    </form>
  );
}

export function AttributeRegistry({
  definitions,
  categories,
  canWrite,
  failed,
}: Readonly<{
  definitions: readonly AttributeDefinition[];
  categories: readonly AdminCategory[];
  canWrite: boolean;
  failed: boolean;
}>) {
  const [code, setCode] = useState<string | null>(null);
  const selected = definitions.find((definition) => definition.code === code);
  if (failed) return <Alert tone="danger">دریافت ویژگی‌ها یا دسته‌ها انجام نشد.</Alert>;
  return (
    <div className="space-y-5">
      <Card title="ویژگی‌های ثبت‌شده">
        {definitions.length ? (
          <ul className="divide-y divide-[var(--admin-color-border)]">
            {definitions.map((definition) => (
              <li
                key={definition.code}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div>
                  <p className="font-semibold">{definition.label}</p>
                  <p className="text-xs text-[var(--admin-color-muted)]">
                    {definition.code} · {ATTRIBUTE_KIND_LABELS[definition.kind]} ·{' '}
                    {ATTRIBUTE_UNIT_LABELS[definition.unit]}
                    {' · '}نسخهٔ {formatAdminInteger(definition.version)} ·{' '}
                    {definition.isActive ? 'فعال' : 'غیرفعال'}
                  </p>
                </div>
                {canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => setCode(definition.code)}>
                    ویرایش {definition.label}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">هنوز ویژگی ثبت نشده است.</p>
        )}
      </Card>
      {canWrite ? (
        <Card title={selected ? `ویرایش ${selected.label}` : 'ویژگی جدید'}>
          {selected ? (
            <Button size="sm" variant="ghost" className="mb-3" onClick={() => setCode(null)}>
              ساخت ویژگی جدید
            </Button>
          ) : null}
          <AttributeEditor
            key={selected ? `${selected.code}-${selected.version}` : 'new'}
            definition={selected}
            categories={categories}
          />
        </Card>
      ) : null}
    </div>
  );
}
