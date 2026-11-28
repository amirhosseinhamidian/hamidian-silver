import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime } from '@/lib/presentation/formatters';
import { saveSeoIssue } from '../actions';
import {
  deliveryLabels,
  eventLabels,
  issueSeverityLabels,
  issueStatusLabels,
  issueTitle,
} from '../issue-labels';

const selectClass =
  'h-10 rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-2';
const notes: Record<string, string> = {
  saved: 'تغییرات ثبت شد.',
  conflict: 'هشدار هم‌زمان تغییر کرده است. اطلاعات جدید را بررسی کنید.',
  invalid: 'وضعیت، مسئول یا یادداشت را بررسی کنید.',
  unavailable: 'ثبت تغییرات ممکن نشد.',
};

export default async function SeoIssuePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { id } = await params;
  const route = `/seo/issues/${id}`;
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: route });
  const query = await searchParams;
  const page =
    typeof query.page === 'string' && /^\d{1,5}$/.test(query.page)
      ? Math.max(1, Math.min(10_000, Number(query.page)))
      : 1;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const result = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/issues/{id}', {
          params: { path: { id }, query: { page } },
          cache: 'no-store',
        })
        .then(
          (result) => result,
          () => undefined,
        )
    : undefined;
  if (result && [400, 404].includes(result.response.status)) notFound();
  const data = result?.data;
  const issue = data?.issue;
  const notice =
    typeof query.result === 'string' && Object.hasOwn(notes, query.result)
      ? notes[query.result]
      : undefined;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{issue ? issueTitle(issue.rule) : 'هشدار سئو'}</h1>
        <ButtonLink href="/seo/issues" variant="outline">
          صندوق هشدارها
        </ButtonLink>
      </header>
      {notice && <p role={query.result === 'saved' ? 'status' : 'alert'}>{notice}</p>}
      {!data || !issue ? (
        <p role="alert">دریافت هشدار ممکن نشد.</p>
      ) : (
        <>
          <Card
            title="وضعیت و شواهد"
            description={`${issueSeverityLabels[issue.severity]} · ${issueStatusLabels[issue.status]} · ${issue.owner?.name ?? 'بدون مسئول'}`}
          >
            <div className="space-y-3 text-sm">
              <p className="break-all">
                <bdi dir="ltr">{issue.subject}</bdi>
              </p>
              <p>
                اولین مشاهده {formatAdminDateTime(issue.firstObservedAt)} · آخرین بررسی{' '}
                {formatAdminDateTime(issue.observedAt)}
              </p>
              <p>
                {issue.active
                  ? 'نشانهٔ مشکل در آخرین بررسی دیده شد.'
                  : 'نشانهٔ مشکل در بررسی جدید دیده نشد.'}
              </p>
              <ul className="space-y-1">
                {[...new Set(issue.evidence.facts)].map((fact) => (
                  <li key={fact} className="break-all">
                    <bdi dir="auto">{fact}</bdi>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={issue.evidence.sourceHref} variant="outline">
                  مشاهدهٔ گزارش منبع
                </ButtonLink>
                {issue.evidence.url && (
                  <a href={issue.evidence.url} className="self-center underline underline-offset-4">
                    مشاهدهٔ صفحه در فروشگاه
                  </a>
                )}
              </div>
            </div>
          </Card>
          {hasAllAdminPermissions(user, ['settings.write']) && (
            <Card title="رسیدگی">
              <form
                action={saveSeoIssue.bind(null, id)}
                className="grid gap-3 text-sm sm:grid-cols-2"
              >
                <input type="hidden" name="revision" value={issue.revision} />
                <label className="grid gap-1">
                  وضعیت
                  <Select
                    name="status"
                    className={selectClass}
                    defaultValue={issue.status}
                    aria-label="وضعیت"
                    options={Object.entries(issueStatusLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </label>
                <label className="grid gap-1">
                  مسئول
                  <Select
                    name="ownerId"
                    className={selectClass}
                    defaultValue={issue.owner?.id ?? ''}
                    aria-label="مسئول"
                    options={[
                      { value: '', label: 'بدون مسئول' },
                      ...(issue.owner && !data.owners.some(({ id }) => id === issue.owner?.id)
                        ? [{ value: issue.owner.id, label: issue.owner.name }]
                        : []),
                      ...data.owners.map(({ id, name }) => ({ value: id, label: name })),
                    ]}
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  یادداشت یا شاهد رسیدگی <Textarea name="note" maxLength={1000} />
                </label>
                <Button type="submit" className="justify-self-start">
                  ثبت تغییرات
                </Button>
              </form>
            </Card>
          )}
          <Card title="تاریخچه و اعلان‌ها">
            <ol className="space-y-3 text-sm">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="space-y-1 border-b border-[var(--admin-color-border)] pb-3"
                >
                  <p className="font-semibold">
                    {eventLabels[event.kind] ?? event.kind} · {event.actor?.name ?? 'سامانه'}
                  </p>
                  <p>{formatAdminDateTime(event.at)}</p>
                  {event.note && <p className="whitespace-pre-wrap break-words">{event.note}</p>}
                  {event.evidence && (
                    <ul className="space-y-1">
                      {[...new Set(event.evidence.facts)].map((fact) => (
                        <li key={fact} className="break-all">
                          <bdi dir="auto">{fact}</bdi>
                        </li>
                      ))}
                    </ul>
                  )}
                  {event.deliveryStates.length > 0 && (
                    <p>
                      تلگرام ·{' '}
                      {event.deliveryStates
                        .map((status) => deliveryLabels[status] ?? status)
                        .join('، ')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {(page > 1 || data.eventCount > data.pageSize) && (
              <nav className="mt-4 flex gap-2" aria-label="صفحه‌بندی تاریخچه">
                {page > 1 && (
                  <ButtonLink href={`${route}?page=${page - 1}`} variant="outline">
                    قبلی
                  </ButtonLink>
                )}
                {page * data.pageSize < data.eventCount && (
                  <ButtonLink href={`${route}?page=${page + 1}`} variant="outline">
                    بعدی
                  </ButtonLink>
                )}
              </nav>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
