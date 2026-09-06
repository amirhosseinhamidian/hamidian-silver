import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { getAdminSection } from '@/lib/navigation/admin-navigation';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type AdminSectionPageProps = Readonly<{
  params: Promise<{ section: string }>;
}>;

export default async function AdminSectionPage({ params }: AdminSectionPageProps) {
  const { section } = await params;
  const definition = getAdminSection(section);
  if (!definition) notFound();

  await requireAdminSession({
    permissions: definition.permissions,
    returnTo: definition.href,
  });

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">مرحله {formatAdminInteger(definition.roadmapStage)}</Badge>
            <Badge tone="neutral">زیرساخت آماده</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">{definition.label}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
            {definition.description}. ساختار دسترسی، ناوبری و صفحه عملیاتی این بخش آماده شده و رابط
            تخصصی آن مطابق رودمپ تکمیل می‌شود.
          </p>
        </div>
        <ButtonLink href="/" variant="outline">
          بازگشت به داشبورد
        </ButtonLink>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title="فضای عملیاتی" description="محتوای تخصصی این بخش در مرحله مربوط اضافه می‌شود">
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[var(--admin-color-border-strong)] bg-[var(--admin-color-surface-subtle)] p-6 text-center">
            <div>
              <p className="font-bold text-[var(--admin-color-ink)]">مسیر امن و آماده توسعه است</p>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
                این صفحه تنها برای جلوگیری از مسیر ناقص ایجاد شده و داده نمایشی ندارد.
              </p>
            </div>
          </div>
        </Card>
        <Card title="وضعیت پیاده‌سازی">
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-color-muted)]">مرحله رودمپ</dt>
              <dd className="font-bold">{formatAdminInteger(definition.roadmapStage)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-color-muted)]">کنترل دسترسی</dt>
              <dd className="font-bold text-[var(--admin-color-success)]">فعال</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--admin-color-muted)]">نمایش موبایل</dt>
              <dd className="font-bold text-[var(--admin-color-success)]">آماده</dd>
            </div>
          </dl>
        </Card>
      </div>
    </main>
  );
}
