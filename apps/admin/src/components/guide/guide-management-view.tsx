'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { GuideManagementData } from '@/lib/guide/guide-data';
import {
  guideFormatLabel,
  guideStatusLabel,
  type GuideArticle,
  type GuideArticleFormat,
  type GuideArticleStatus,
  type GuideFilters,
  type GuideTopic,
} from '@/lib/guide/guide-model';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';

const STATUS_TONE: Record<GuideArticleStatus, BadgeTone> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

function responseMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return fallback;
}

function listHref(filters: GuideFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.format) query.set('format', filters.format);
  if (filters.topic) query.set('topic', filters.topic);
  if (page > 1) query.set('page', String(page));
  if (filters.limit !== 20) query.set('limit', String(filters.limit));
  return query.size ? `/knowledge?${query.toString()}` : '/knowledge';
}

function ArticleStatusActions({
  article,
  canWrite,
}: Readonly<{ article: GuideArticle; canWrite: boolean }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(status: GuideArticleStatus) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/guide/articles/${article.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedVersion: article.version }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload, 'تغییر وضعیت انجام نشد.'));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تغییر وضعیت انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  if (!canWrite)
    return <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href={`/knowledge/${article.id}/edit`} size="sm" variant="outline">
        ویرایش
      </ButtonLink>
      {article.status !== 'PUBLISHED' ? (
        <Button size="sm" loading={pending} onClick={() => void change('PUBLISHED')}>
          انتشار
        </Button>
      ) : (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => void change('DRAFT')}>
          بازگشت به پیش‌نویس
        </Button>
      )}
      {article.status !== 'ARCHIVED' ? (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => void change('ARCHIVED')}>
          آرشیو
        </Button>
      ) : null}
      {error ? (
        <span role="alert" className="w-full text-xs text-[var(--admin-color-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function TopicManager({
  topics,
  canWrite,
}: Readonly<{ topics: readonly GuideTopic[]; canWrite: boolean }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GuideTopic | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start(topic?: GuideTopic) {
    setEditing(topic ?? null);
    setName(topic?.name ?? '');
    setSlug(topic?.slug ?? '');
    setDescription(topic?.description ?? '');
    setError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return setError('نام و اسلاگ موضوع الزامی است.');
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        editing ? `/api/guide/topics/${editing.id}` : '/api/guide/topics',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseMessage(payload, 'ذخیره موضوع انجام نشد.'));
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره موضوع انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title="موضوعات دانستنی‌ها"
      description="ساختار موضوعی برای نقره، ساعت و گروه‌های محصول آینده."
      action={
        canWrite ? (
          <Button size="sm" variant="outline" onClick={() => start()}>
            موضوع جدید
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={!canWrite}
            onClick={() => start(topic)}
            className="rounded-full border border-[var(--admin-color-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--admin-color-surface-hover)] disabled:pointer-events-none"
          >
            {topic.name}
            {!topic.isActive ? ' · غیرفعال' : ''}
          </button>
        ))}
        {!topics.length ? (
          <p className="text-sm text-[var(--admin-color-muted)]">هنوز موضوعی ساخته نشده است.</p>
        ) : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={editing ? 'ویرایش موضوع' : 'موضوع جدید'}
          description="موضوع‌ها برای فیلتر و ساخت صفحه‌های فرود محتوایی استفاده می‌شوند."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">انصراف</Button>
              </DialogClose>
              <Button type="submit" form="guide-topic-form" loading={pending}>
                ذخیره موضوع
              </Button>
            </>
          }
        >
          <form
            id="guide-topic-form"
            className="space-y-4"
            onSubmit={(event) => void submit(event)}
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <FormField id="guide-topic-name" label="نام موضوع" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  maxLength={150}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField
              id="guide-topic-slug"
              label="اسلاگ انگلیسی"
              required
              hint="نمونه: silver-care"
            >
              {(props) => (
                <Input
                  {...props}
                  dir="ltr"
                  value={slug}
                  maxLength={180}
                  onChange={(event) => setSlug(event.target.value)}
                />
              )}
            </FormField>
            <FormField id="guide-topic-description" label="توضیح کوتاه">
              {(props) => (
                <Textarea
                  {...props}
                  value={description}
                  maxLength={1000}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </FormField>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function GuideManagementView({
  data,
  filters,
  canWrite,
}: Readonly<{ data: GuideManagementData; filters: GuideFilters; canWrite: boolean }>) {
  const list = data.articles;
  const articles = list?.items ?? [];
  const columns: readonly DataTableColumn<GuideArticle>[] = [
    {
      id: 'title',
      header: 'دانستنی',
      cell: (article: GuideArticle) => (
        <div>
          <p className="font-bold">{article.title}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-subtle)]" dir="ltr">
            {article.slug}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (article: GuideArticle) => (
        <Badge tone={STATUS_TONE[article.status]} dot>
          {guideStatusLabel(article.status)}
        </Badge>
      ),
    },
    {
      id: 'format',
      header: 'نوع',
      visibility: 'sm' as const,
      cell: (article: GuideArticle) => guideFormatLabel(article.format),
    },
    {
      id: 'blocks',
      header: 'بخش‌ها',
      visibility: 'md' as const,
      align: 'center' as const,
      cell: (article: GuideArticle) => formatAdminInteger(article.blockCount),
    },
    {
      id: 'updated',
      header: 'آخرین ویرایش',
      visibility: 'lg' as const,
      cell: (article: GuideArticle) => formatAdminDateTime(article.updatedAt),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end' as const,
      cell: (article: GuideArticle) => (
        <ArticleStatusActions article={article} canWrite={canWrite} />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      {data.failed ? (
        <Alert tone="danger">دریافت اطلاعات دانستنی‌ها انجام نشد. اتصال API را بررسی کنید.</Alert>
      ) : null}
      <TopicManager topics={data.topics} canWrite={canWrite} />
      <form action="/knowledge">
        <FilterBar
          activeCount={
            [filters.q, filters.status, filters.format, filters.topic].filter(Boolean).length
          }
          actions={
            <Button type="submit" variant="outline">
              اعمال فیلتر
            </Button>
          }
          resetAction={
            <ButtonLink href="/knowledge" size="sm" variant="ghost">
              پاک‌کردن فیلترها
            </ButtonLink>
          }
        >
          <SearchField
            name="q"
            defaultValue={filters.q}
            placeholder="جست‌وجوی عنوان یا کلیدواژه…"
          />
          <Select
            name="status"
            defaultValue={filters.status || 'all'}
            aria-label="وضعیت"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'DRAFT', label: 'پیش‌نویس' },
              { value: 'PUBLISHED', label: 'منتشرشده' },
              { value: 'ARCHIVED', label: 'آرشیوشده' },
            ]}
          />
          <Select
            name="format"
            defaultValue={filters.format || 'all'}
            aria-label="نوع محتوا"
            options={[
              { value: 'all', label: 'همه انواع' },
              ...(
                [
                  'GUIDE',
                  'ANSWER',
                  'BUYING_GUIDE',
                  'CARE_GUIDE',
                  'COMPARISON',
                  'STORY',
                ] as GuideArticleFormat[]
              ).map((format) => ({ value: format, label: guideFormatLabel(format) })),
            ]}
          />
          <Select
            name="topic"
            defaultValue={filters.topic || 'all'}
            aria-label="موضوع"
            options={[
              { value: 'all', label: 'همه موضوعات' },
              ...data.topics.map((topic) => ({ value: topic.slug, label: topic.name })),
            ]}
          />
        </FilterBar>
      </form>
      <ResponsiveDataView<GuideArticle>
        caption="فهرست دانستنی‌ها"
        mobileLabel="دانستنی‌ها"
        rows={articles}
        getRowKey={(article) => article.id}
        columns={columns}
        emptyTitle="هنوز دانستنی‌ای ثبت نشده است"
        emptyDescription="اولین محتوای آموزشی یا راهنمای خرید را بسازید."
        renderMobileCard={(article) => (
          <MobileDataCard
            title={article.title}
            eyebrow={guideFormatLabel(article.format)}
            status={
              <Badge tone={STATUS_TONE[article.status]}>{guideStatusLabel(article.status)}</Badge>
            }
            items={[
              {
                label: 'موضوعات',
                value: article.topics.map((topic) => topic.name).join('، ') || 'بدون موضوع',
              },
              { label: 'آخرین ویرایش', value: formatAdminDateTime(article.updatedAt) },
            ]}
            detailsTitle={article.title}
            details={
              <div className="space-y-4">
                <p className="text-sm leading-7 text-[var(--admin-color-muted)]">
                  {article.excerpt ?? 'برای این دانستنی خلاصه‌ای ثبت نشده است.'}
                </p>
                <ArticleStatusActions article={article} canWrite={canWrite} />
              </div>
            }
          />
        )}
        footer={
          list ? (
            <Pagination
              currentPage={list.page}
              totalPages={Math.max(1, list.totalPages)}
              totalItems={list.total}
              pageSize={list.limit}
              getPageHref={(page) => listHref(filters, page)}
            />
          ) : undefined
        }
      />
    </div>
  );
}
