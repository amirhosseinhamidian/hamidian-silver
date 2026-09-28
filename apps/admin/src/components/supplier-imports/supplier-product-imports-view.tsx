/* eslint-disable @next/next/no-img-element */
'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { SupplierBulkCrawlCard } from './supplier-bulk-crawl-card';
import { SupplierCrawlScheduleCard } from './supplier-crawl-schedule-card';
import { SupplierCategoryMappingCard } from './supplier-category-mapping-card';
import { SupplierSourceChangesCard } from './supplier-source-changes-card';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
} from '@/lib/presentation/formatters';
import {
  buildSupplierImportsHref,
  type AdminSupplierImportDraft,
  type AdminSupplierImportFilters,
  type AdminSupplierImportPage,
  type AdminSupplierImportSource,
  type AdminSupplierImportStatus,
  type AdminSupplierCrawlRun,
  type AdminSupplierCrawlSchedule,
  type AdminSupplierSourceCategory,
  type AdminSupplierCatalogCategory,
  type AdminSupplierSourceChange,
} from '@/lib/supplier-imports/supplier-imports-model';

type Props = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  drafts: AdminSupplierImportPage<AdminSupplierImportDraft>;
  categories: readonly AdminSupplierSourceCategory[];
  runs: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  archivedRuns: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  schedules?: readonly AdminSupplierCrawlSchedule[];
  catalogCategories?: readonly AdminSupplierCatalogCategory[];
  sourceChanges?: readonly AdminSupplierSourceChange[];
  filters: AdminSupplierImportFilters;
  failed: boolean;
  canWrite: boolean;
}>;

const statusOptions = [
  { value: 'ALL', label: 'همه وضعیت‌ها' },
  { value: 'PENDING_REVIEW', label: 'نیازمند بازبینی' },
  { value: 'REVIEWED', label: 'بازبینی‌شده' },
  { value: 'REJECTED', label: 'ردشده' },
  { value: 'IMPORTED', label: 'واردشده به کاتالوگ' },
] as const;

function statusBadge(status: AdminSupplierImportStatus) {
  if (status === 'IMPORTED') return <Badge tone="success">واردشده</Badge>;
  if (status === 'REVIEWED') return <Badge tone="success">بازبینی‌شده</Badge>;
  if (status === 'REJECTED') return <Badge tone="danger">ردشده</Badge>;
  return <Badge tone="warning">نیازمند بازبینی</Badge>;
}

function apiError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'عملیات انجام نشد. دوباره تلاش کنید.';
}

async function requestJson(path: string, method: 'POST' | 'PATCH', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(apiError(payload));
  return payload;
}

function attributesToText(draft: AdminSupplierImportDraft): string {
  return draft.attributes.map((attribute) => `${attribute.key}: ${attribute.value}`).join('\n');
}

function parseAttributes(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator < 1) return null;
      const key = line.slice(0, separator).trim();
      const attributeValue = line.slice(separator + 1).trim();
      return key && attributeValue ? { key, value: attributeValue } : null;
    });
}

function DraftEditor({
  draft,
  onSaved,
}: Readonly<{ draft: AdminSupplierImportDraft; onSaved: () => void }>) {
  const router = useRouter();
  const [status, setStatus] = useState<AdminSupplierImportStatus>(draft.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attributes = parseAttributes(String(form.get('attributes') ?? ''));
    if (attributes.some((attribute) => attribute === null)) {
      setError('هر ویژگی را در یک خط و به‌شکل «عنوان: مقدار» وارد کنید.');
      return;
    }
    const title = String(form.get('title') ?? '').trim();
    if (!title) return setError('عنوان محصول الزامی است.');
    const numberOrNull = (name: string) => {
      const value = toAsciiDigits(String(form.get(name) ?? ''))
        .replace('٫', '.')
        .trim();
      return value ? Number(value) : null;
    };
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/supplier-imports/drafts/${draft.id}`, 'PATCH', {
        title,
        description: String(form.get('description') ?? '').trim() || null,
        sourceCategory: String(form.get('sourceCategory') ?? '').trim() || null,
        supplierRetailPriceToman: numberOrNull('supplierRetailPriceToman'),
        weightGrams: numberOrNull('weightGrams'),
        attributes,
        status,
      });
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      id="supplier-import-draft-form"
      className="space-y-4"
      onSubmit={(event) => void submit(event)}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Alert tone="info">
        تأیید در این مرحله فقط اطلاعات را بازبینی‌شده می‌کند؛ ساخت محصول در کاتالوگ در مرحله بعد
        انجام می‌شود.
      </Alert>
      <FormField id="import-title" label="عنوان محصول" required>
        {(props) => <Input {...props} name="title" defaultValue={draft.title} required />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="import-category" label="دسته‌بندی در سایت تأمین‌کننده">
          {(props) => (
            <Input {...props} name="sourceCategory" defaultValue={draft.sourceCategory ?? ''} />
          )}
        </FormField>
        <FormField id="import-price" label="قیمت تک‌فروشی تأمین‌کننده (تومان)">
          {(props) => (
            <Input
              {...props}
              name="supplierRetailPriceToman"
              inputMode="numeric"
              defaultValue={draft.supplierRetailPriceToman ?? ''}
            />
          )}
        </FormField>
        <FormField id="import-weight" label="وزن تقریبی (گرم)">
          {(props) => (
            <Input
              {...props}
              name="weightGrams"
              inputMode="decimal"
              defaultValue={draft.weightGrams ?? ''}
            />
          )}
        </FormField>
        <FormField id="import-status" label="وضعیت بازبینی">
          {(props) => (
            <Select
              {...props}
              value={status}
              onValueChange={(value) => setStatus(value as AdminSupplierImportStatus)}
              options={statusOptions.filter(
                (option) => option.value !== 'ALL' && option.value !== 'IMPORTED',
              )}
            />
          )}
        </FormField>
      </div>
      <FormField id="import-description" label="توضیحات دریافتی">
        {(props) => (
          <Textarea {...props} name="description" defaultValue={draft.description ?? ''} />
        )}
      </FormField>
      <FormField
        id="import-attributes"
        label="ویژگی‌ها"
        hint="هر ویژگی در یک خط؛ مثال: نوع آبکاری: رادیوم"
      >
        {(props) => (
          <Textarea
            {...props}
            name="attributes"
            className="min-h-40"
            defaultValue={attributesToText(draft)}
          />
        )}
      </FormField>
      <Button type="submit" loading={pending} className="w-full">
        ذخیره بازبینی
      </Button>
    </form>
  );
}

export function SupplierProductImportsView({
  sources,
  drafts,
  categories,
  runs,
  archivedRuns,
  schedules = [],
  catalogCategories = [],
  sourceChanges = [],
  filters,
  failed,
  canWrite,
}: Props) {
  const router = useRouter();
  const supportedSources = sources.filter((source) => source.supported);
  const [sourceId, setSourceId] = useState(supportedSources[0]?.id ?? '');
  const [selectedDraft, setSelectedDraft] = useState<AdminSupplierImportDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const visibleDrafts = drafts.items;

  async function crawl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const productUrl = String(form.get('productUrl') ?? '').trim();
    if (!sourceId || !productUrl) return;
    setPending(true);
    setMessage(null);
    try {
      await requestJson('/api/supplier-imports/crawl', 'POST', {
        supplierSourceId: sourceId,
        targetUrl: productUrl,
      });
      setMessage({ tone: 'success', text: 'محصول دریافت شد و برای بازبینی در فهرست قرار گرفت.' });
      formElement.reset();
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'danger',
        text: caught instanceof Error ? caught.message : apiError(null),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {failed ? (
        <Alert tone="danger" title="دریافت اطلاعات ناموفق بود">
          ارتباط با سرویس ورود محصول برقرار نشد. صفحه را دوباره بارگذاری کنید.
        </Alert>
      ) : null}

      <SupplierCrawlScheduleCard
        sources={sources}
        categories={categories}
        schedules={schedules}
        canWrite={canWrite}
      />

      <SupplierSourceChangesCard changes={sourceChanges} canWrite={canWrite} />

      <SupplierCategoryMappingCard
        sources={sources}
        categories={categories}
        catalogCategories={catalogCategories}
        canWrite={canWrite}
      />

      <SupplierBulkCrawlCard
        sources={sources}
        categories={categories}
        runs={runs}
        archivedRuns={archivedRuns}
        filters={filters}
        canWrite={canWrite}
      />

      <Card
        title="دریافت یک محصول"
        description="نشانی دقیق صفحه محصول را وارد کنید. خزنده فقط همان دامنه ثبت‌شده را می‌خواند."
      >
        {supportedSources.length === 0 ? (
          <Alert tone="warning">
            هنوز منبع فعالی با آداپتر پشتیبانی‌شده ثبت نشده است. آداپتر BSJ باید با کلید bsj-silver
            در مدیریت تأمین‌کنندگان ثبت شود.
          </Alert>
        ) : (
          <form
            className="grid gap-3 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(20rem,1.3fr)_auto]"
            onSubmit={(event) => void crawl(event)}
          >
            <Select
              aria-label="سایت تأمین‌کننده"
              value={sourceId}
              onValueChange={setSourceId}
              options={supportedSources.map((source) => ({
                value: source.id,
                label: `${source.supplierName} — ${source.name}`,
              }))}
              disabled={!canWrite}
            />
            <Input
              aria-label="نشانی صفحه محصول"
              name="productUrl"
              type="url"
              dir="ltr"
              placeholder="https://bsjsilver.com/product/..."
              disabled={!canWrite}
              required
            />
            <Button type="submit" loading={pending} disabled={!canWrite || !sourceId}>
              دریافت محصول
            </Button>
          </form>
        )}
        {message ? (
          <Alert tone={message.tone} className="mt-3">
            {message.text}
          </Alert>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black">پیش‌نویس‌های دریافتی</h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminInteger(drafts.total)} پیش‌نویس یافت شد؛{' '}
            {formatAdminInteger(visibleDrafts.length)} مورد در این صفحه نمایش داده می‌شود.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            aria-label="فیلتر تأمین‌کننده پیش‌نویس‌ها"
            value={filters.supplierSourceId}
            onValueChange={(value) =>
              router.push(buildSupplierImportsHref(filters, { supplierSourceId: value, page: 1 }))
            }
            options={[
              { value: 'ALL', label: 'همه تأمین‌کنندگان' },
              ...supportedSources.map((source) => ({
                value: source.id,
                label: source.supplierName,
              })),
            ]}
          />
          <Select
            aria-label="فیلتر وضعیت بازبینی"
            value={filters.status}
            onValueChange={(value) =>
              router.push(
                buildSupplierImportsHref(filters, {
                  status: value as AdminSupplierImportStatus | 'ALL',
                  page: 1,
                }),
              )
            }
            options={statusOptions}
          />
          <Select
            aria-label="تعداد پیش‌نویس در هر صفحه"
            value={String(filters.pageSize)}
            onValueChange={(value) =>
              router.push(buildSupplierImportsHref(filters, { page: 1, pageSize: Number(value) }))
            }
            options={[12, 24, 48, 96].map((value) => ({
              value: String(value),
              label: `${formatAdminInteger(value)} مورد در صفحه`,
            }))}
          />
        </div>
      </div>

      {visibleDrafts.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-[var(--admin-color-muted)]">
            پیش‌نویسی با این وضعیت وجود ندارد.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleDrafts.map((draft) => (
            <Card key={draft.id} className="overflow-hidden p-0">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="aspect-square w-full shrink-0 overflow-hidden bg-[var(--admin-color-surface-subtle)] sm:w-44">
                  {draft.imageUrls[0] ? (
                    <img
                      src={draft.imageUrls[0]}
                      alt={draft.title}
                      className="size-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-xs text-[var(--admin-color-muted)]">
                      بدون تصویر
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3 p-4 sm:ps-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold leading-7">{draft.title}</h3>
                      <p className="text-xs text-[var(--admin-color-muted)]">
                        {draft.source.supplierName} ·{' '}
                        {draft.sourceCategory ?? 'بدون دسته‌بندی منبع'}
                      </p>
                    </div>
                    <div>
                      <dt className="text-[var(--admin-color-muted)]">موجودی در منبع</dt>
                      <dd className="mt-1 font-semibold">
                        {draft.sourceAvailability === 'IN_STOCK'
                          ? 'موجود'
                          : draft.sourceAvailability === 'OUT_OF_STOCK'
                            ? 'ناموجود'
                            : 'نامشخص'}
                      </dd>
                    </div>
                    {statusBadge(draft.status)}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-[var(--admin-color-muted)]">قیمت تک‌فروشی منبع</dt>
                      <dd className="mt-1 font-semibold">
                        {draft.supplierRetailPriceToman === null
                          ? '—'
                          : formatAdminToman(draft.supplierRetailPriceToman)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--admin-color-muted)]">وزن</dt>
                      <dd className="mt-1 font-semibold">
                        {draft.weightGrams === null ? '—' : `${draft.weightGrams} گرم`}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs text-[var(--admin-color-muted)]">
                    آخرین دریافت: {formatAdminDateTime(draft.lastCrawledAt)}
                  </p>
                  {draft.importedAt ? (
                    <p className="text-xs text-[var(--admin-color-success)]">
                      واردشده به کاتالوگ در {formatAdminDateTime(draft.importedAt)}
                      {draft.importedBy ? ` · توسط ${draft.importedBy}` : ''}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={draft.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-8 items-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-2.5 text-xs font-semibold"
                    >
                      مشاهده منبع
                    </a>
                    {draft.imageUrls.map((_url, index) => (
                      <a
                        key={index}
                        href={`/api/supplier-imports/drafts/${draft.id}/images/${index}/download`}
                        className="inline-flex min-h-8 items-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-2.5 text-xs font-semibold"
                      >
                        دانلود تصویر {formatAdminInteger(index + 1)}
                      </a>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {draft.product ? (
                      <ButtonLink href={`/products/${draft.product.id}/edit`} size="sm">
                        ویرایش محصول ساخته‌شده
                      </ButtonLink>
                    ) : draft.status !== 'REJECTED' ? (
                      <ButtonLink
                        href={`/products/new?importDraftId=${encodeURIComponent(draft.id)}`}
                        size="sm"
                      >
                        تکمیل و ساخت محصول
                      </ButtonLink>
                    ) : null}
                    {draft.status !== 'IMPORTED' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedDraft(draft)}
                        disabled={!canWrite}
                      >
                        بازبینی و ویرایش
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        currentPage={drafts.page}
        totalPages={drafts.totalPages}
        totalItems={drafts.total}
        pageSize={drafts.pageSize}
        getPageHref={(page) => buildSupplierImportsHref(filters, { page })}
        className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)]"
      />

      <BottomSheet
        open={Boolean(selectedDraft)}
        onOpenChange={(open) => !open && setSelectedDraft(null)}
      >
        {selectedDraft ? (
          <BottomSheetContent
            title="بازبینی محصول دریافتی"
            description={selectedDraft.source.supplierName}
            height="large"
          >
            <DraftEditor draft={selectedDraft} onSaved={() => setSelectedDraft(null)} />
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
    </div>
  );
}
