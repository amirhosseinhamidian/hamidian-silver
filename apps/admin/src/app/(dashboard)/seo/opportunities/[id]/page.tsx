import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { updateSeoOpportunity } from '../actions';
import {
  actionLabels,
  opportunityLabel,
  opportunityPath,
  rankWeights,
  readPage,
  statusLabels,
  type Opportunity,
  type OpportunityAction,
} from '../opportunity-labels';

type Metrics = components['schemas']['SeoOpportunityMetricsDto'];
const notices: Record<string, string> = {
  saved: 'تغییر ثبت شد.',
  conflict: 'پیشنهاد هم‌زمان به‌روزرسانی شده است. نسخهٔ تازه را بررسی کنید.',
  invalid: 'اقدام، تاریخ یا توضیح را بررسی کنید.',
  unavailable: 'ثبت تغییرات ممکن نشد.',
};
const decimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const display = (number: number | null, suffix = '') =>
  number === null ? '—' : decimal.format(number) + suffix;

function MetricWindow({ title, window }: Readonly<{ title: string; window: Metrics }>) {
  return (
    <div className="space-y-1 text-sm">
      <h3 className="font-semibold">{title}</h3>
      <p>
        <bdi dir="ltr">{window.start}</bdi> تا <bdi dir="ltr">{window.end}</bdi>
      </p>
      <p>
        {formatAdminInteger(window.observedDays)} از {formatAdminInteger(window.days)} روز داده
        دارد.
      </p>
      <p>
        کلیک {display(window.clicks)} · نمایش {display(window.impressions)}
      </p>
      <p>
        CTR {display(window.ctr === null ? null : window.ctr * 100, '٪')} · رتبهٔ وزنی{' '}
        {display(window.position)}
      </p>
      {window.cappedDays > 0 && (
        <p>{formatAdminInteger(window.cappedDays)} روز با سقف گزارش Google</p>
      )}
    </div>
  );
}

function decisionActions(item: Opportunity): OpportunityAction[] {
  if (item.status === 'TASK_CREATED') return [];
  if (item.status === 'REJECTED') return ['REOPEN'];
  return [
    ...(item.status === 'DEFERRED' ? ['REOPEN' as const] : []),
    ...(item.active && item.status !== 'APPROVED' ? ['APPROVE' as const] : []),
    ...(item.active ? ['CREATE_TASK' as const] : []),
    'REJECT',
    'DEFER',
  ];
}

export default async function SeoOpportunityPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { id } = await params;
  const path = `${opportunityPath}/${id}`;
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: path });
  const query = await searchParams;
  const page = readPage(query.page);
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const response = token
    ? await createAdminApiClient(token)
        .GET('/api/v1/seo/opportunities/{id}', {
          params: { path: { id }, query: { page } },
          cache: 'no-store',
        })
        .then(
          (r) => r,
          () => undefined,
        )
    : undefined;
  if (response && [400, 404].includes(response.response.status)) notFound();
  const data = response?.data;
  const item = data?.item;
  const actions = item ? decisionActions(item) : [];
  const task = data?.task;
  const canWrite = hasAllAdminPermissions(user, ['settings.write']);
  const notice =
    typeof query.result === 'string' && Object.hasOwn(notices, query.result)
      ? notices[query.result]
      : undefined;
  const action = updateSeoOpportunity.bind(null, id);

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{item ? opportunityLabel(item.rule) : 'فرصت سئو'}</h1>
        <ButtonLink href={opportunityPath} variant="outline">
          صف فرصت‌ها
        </ButtonLink>
      </header>
      {notice && <p role={query.result === 'saved' ? 'status' : 'alert'}>{notice}</p>}
      {!data || !item ? (
        <p role="alert">دریافت پیشنهاد ممکن نشد.</p>
      ) : (
        <>
          <Card title={item.title} description={statusLabels[item.status]}>
            <div className="space-y-3 text-sm">
              <p className="break-all">
                <bdi dir="ltr">{item.url}</bdi>
              </p>
              <p className="font-semibold">{item.evidence.reason}</p>
              <p>{item.evidence.recommendation}</p>
              {!item.active && <p>شاهد تازه از پیشنهاد پشتیبانی نمی‌کند.</p>}
              {item.deferredUntil && (
                <p>
                  تعویق تا <bdi dir="ltr">{item.deferredUntil}</bdi>
                </p>
              )}
              <ul className="space-y-1">
                {[...new Set(item.evidence.facts)].map((fact) => (
                  <li className="break-words" key={fact}>
                    {fact}
                  </li>
                ))}
              </ul>
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricWindow title="بازهٔ جاری" window={item.evidence.current} />
                <MetricWindow title="بازهٔ پیشین" window={item.evidence.previous} />
              </div>
              <details>
                <summary className="cursor-pointer font-semibold">
                  جزئیات امتیاز {formatAdminInteger(item.score)} از ۱۰۰ · نسخهٔ{' '}
                  {formatAdminInteger(item.scoreVersion)}
                </summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {Object.entries(rankWeights).map(([key, label]) => (
                    <div className="contents" key={key}>
                      <dt>{label}</dt>
                      <dd>{display(item.evidence.components[key as keyof typeof rankWeights])}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <ul className="space-y-1 text-xs text-[var(--admin-color-muted)]">
                {item.evidence.limitations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={item.evidence.reportHref} variant="outline">
                  گزارش عملکرد صفحه
                </ButtonLink>
                <a href={item.url} className="self-center underline underline-offset-4">
                  صفحه در فروشگاه
                </a>
              </div>
            </div>
          </Card>
          {canWrite && actions.length > 0 && (
            <Card title="تصمیم">
              <form action={action} className="grid gap-3 text-sm">
                <input type="hidden" name="revision" value={item.revision} />
                <label className="grid gap-1">
                  یادداشت تصمیم <Textarea name="note" maxLength={1000} />
                </label>
                {actions.includes('DEFER') && (
                  <label className="grid max-w-xs gap-1">
                    تاریخ برای تعویق <Input type="date" name="date" dir="ltr" />
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  {actions.map((decision) => (
                    <Button
                      key={decision}
                      type="submit"
                      name="action"
                      value={decision}
                      variant={decision === 'APPROVE' ? 'primary' : 'outline'}
                    >
                      {actionLabels[decision]}
                    </Button>
                  ))}
                </div>
              </form>
            </Card>
          )}
          {task && (
            <Card title="تسک اصلاحی و ارزیابی اثر">
              <div className="space-y-4 text-sm">
                <p>{task.instruction}</p>
                <p className="break-all">
                  <bdi dir="ltr">{task.url}</bdi>
                </p>
                {task.implementedOn && (
                  <p>
                    اجرا در <bdi dir="ltr">{task.implementedOn}</bdi> · {task.changeNote}
                  </p>
                )}
                {task.confounders && <p>عوامل مداخله‌گر · {task.confounders}</p>}
                {canWrite && (
                  <>
                    <form
                      action={action}
                      className="grid gap-3 rounded-lg border border-[var(--admin-color-border)] p-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="revision" value={item.revision} />
                      <label className="grid gap-1">
                        تاریخ اجرا{' '}
                        <Input
                          name="date"
                          type="date"
                          defaultValue={task.implementedOn ?? undefined}
                          dir="ltr"
                          required
                        />
                      </label>
                      <label className="grid gap-1">
                        طول هر بازه
                        <Select
                          name="windowDays"
                          defaultValue={String(task.windowDays ?? 14)}
                          className="h-10 rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-2"
                          aria-label="طول هر بازه"
                          options={[7, 14, 28].map((count) => ({
                            value: String(count),
                            label: `${formatAdminInteger(count)} روز`,
                          }))}
                        />
                      </label>
                      <label className="grid gap-1 sm:col-span-2">
                        تغییر انجام‌شده{' '}
                        <Textarea
                          name="note"
                          defaultValue={task.changeNote ?? ''}
                          maxLength={1000}
                          required
                        />
                      </label>
                      <label className="grid gap-1 sm:col-span-2">
                        عوامل مداخله‌گر مثل کمپین، تغییر موجودی یا فصل{' '}
                        <Textarea
                          name="confounders"
                          defaultValue={task.confounders ?? ''}
                          maxLength={1000}
                        />
                      </label>
                      <Button
                        type="submit"
                        name="action"
                        value="IMPLEMENT"
                        className="justify-self-start"
                      >
                        {actionLabels.IMPLEMENT}
                      </Button>
                    </form>
                    {task.implementedOn && (
                      <form action={action}>
                        <input type="hidden" name="revision" value={item.revision} />
                        <Button type="submit" name="action" value="MEASURE" variant="outline">
                          {actionLabels.MEASURE}
                        </Button>
                      </form>
                    )}
                  </>
                )}
                {task.impact && (
                  <div className="space-y-3">
                    <p>
                      {task.impact.status === 'READY'
                        ? 'هر دو بازه دادهٔ کامل دارند.'
                        : 'گزارش در انتظار تکمیل داده است.'}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricWindow title="پیش از اجرا" window={task.impact.before} />
                      <MetricWindow title="پس از اجرا" window={task.impact.after} />
                    </div>
                    <p>
                      اختلاف کلیک {display(task.impact.clickDifference)} · اختلاف نمایش{' '}
                      {display(task.impact.impressionDifference)} · اختلاف CTR{' '}
                      {display(task.impact.ctrPointDifference, ' واحد درصد')}
                    </p>
                    <p>این مقایسهٔ مشاهده‌ای برای بازبینی همراه با عوامل مداخله‌گر ثبت شده است.</p>
                  </div>
                )}
              </div>
            </Card>
          )}
          {data.history.length > 0 && (
            <Card title="تاریخچهٔ اقدامات">
              <ol className="space-y-3 text-sm">
                {data.history.map((event) => (
                  <li key={event.id} className="border-b border-[var(--admin-color-border)] pb-2">
                    <p>
                      {actionLabels[event.action as OpportunityAction] ?? event.action} ·{' '}
                      {event.actor ?? 'سامانه'} · {formatAdminDateTime(event.at)}
                    </p>
                    {event.note && <p className="whitespace-pre-wrap break-words">{event.note}</p>}
                  </li>
                ))}
              </ol>
              {(page > 1 || data.eventCount > data.pageSize) && (
                <nav aria-label="صفحه‌بندی تاریخچه" className="mt-4 flex gap-2">
                  {page > 1 && (
                    <ButtonLink href={`${path}?page=${page - 1}`} variant="outline">
                      قبلی
                    </ButtonLink>
                  )}
                  {page * data.pageSize < data.eventCount && (
                    <ButtonLink href={`${path}?page=${page + 1}`} variant="outline">
                      بعدی
                    </ButtonLink>
                  )}
                </nav>
              )}
            </Card>
          )}
        </>
      )}
    </main>
  );
}
