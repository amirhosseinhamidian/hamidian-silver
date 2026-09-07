'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type {
  AdminStockNotificationSummary,
  AdminStockNotificationTarget,
} from '@/lib/inventory-alerts/inventory-alerts-model';
import type { AdminInventoryItem, AdminWarehouse } from '@/lib/inventory/inventory-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type InventoryAlertsViewProps = Readonly<{
  warehouses: readonly AdminWarehouse[];
  inventory: readonly AdminInventoryItem[];
  selectedWarehouseId: string | null;
  warehousesFailed: boolean;
  inventoryFailed: boolean;
  notifications: AdminStockNotificationSummary | null;
  notificationsFailed: boolean;
}>;

function variantLabel(item: AdminInventoryItem): string {
  return item.variantName ?? item.sizeLabel ?? 'تنوع اصلی';
}

function targetLabel(target: AdminStockNotificationTarget): string {
  if (!target.variantId) return 'تمام تنوع‌های محصول';
  return target.variantName ?? target.sizeLabel ?? 'تنوع اصلی';
}

function alertBadge(item: AdminInventoryItem) {
  if (item.available <= 0)
    return (
      <Badge tone="danger" dot>
        ناموجود
      </Badge>
    );
  return (
    <Badge tone="warning" dot>
      کم‌موجود
    </Badge>
  );
}

function demandBadge(target: AdminStockNotificationTarget) {
  if (target.activeCount > 0)
    return (
      <Badge tone="warning" dot>
        در انتظار موجودی
      </Badge>
    );
  if (target.queuedCount > 0)
    return (
      <Badge tone="info" dot>
        در صف ارسال
      </Badge>
    );
  return <Badge tone="success">اطلاع‌رسانی‌شده</Badge>;
}

function InventoryAlertDetails({
  item,
  inventoryHref,
}: Readonly<{ item: AdminInventoryItem; inventoryHref: string }>) {
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-[var(--admin-color-border)]">
        {[
          ['محصول', item.productName],
          ['تنوع', variantLabel(item)],
          ['SKU', toPersianDigits(item.sku)],
          ['موجودی واقعی', formatAdminInteger(item.onHand)],
          ['رزروشده', formatAdminInteger(item.reserved)],
          ['قابل فروش', formatAdminInteger(item.available)],
          ['نقطه هشدار', formatAdminInteger(item.lowStockThreshold)],
          ['آخرین تغییر', item.updatedAt ? formatAdminDateTime(item.updatedAt) : 'هنوز ثبت نشده'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-[var(--admin-color-muted)]">{label}</dt>
            <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <ButtonLink href={inventoryHref} className="w-full">
        اصلاح موجودی این انبار
      </ButtonLink>
    </div>
  );
}

function DemandDetails({ target }: Readonly<{ target: AdminStockNotificationTarget }>) {
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-[var(--admin-color-border)]">
        {[
          ['محصول', target.productName],
          ['هدف درخواست', targetLabel(target)],
          ['SKU', target.sku ? toPersianDigits(target.sku) : 'کل محصول'],
          ['در انتظار موجودی', formatAdminInteger(target.activeCount)],
          ['در صف ارسال', formatAdminInteger(target.queuedCount)],
          ['اطلاع‌رسانی‌شده', formatAdminInteger(target.notifiedCount)],
          ['لغوشده', formatAdminInteger(target.cancelledCount)],
          [
            'آخرین درخواست',
            target.lastRequestedAt ? formatAdminDateTime(target.lastRequestedAt) : 'ثبت نشده',
          ],
          [
            'آخرین ارسال',
            target.lastNotifiedAt ? formatAdminDateTime(target.lastNotifiedAt) : 'هنوز ارسال نشده',
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-[var(--admin-color-muted)]">{label}</dt>
            <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <ButtonLink href={`/products/${target.productId}/edit`} variant="outline" className="w-full">
        مشاهده محصول
      </ButtonLink>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: number; tone?: 'danger' | 'warning' | 'info' }>) {
  const color = {
    danger: 'text-[var(--admin-color-danger)]',
    warning: 'text-[var(--admin-color-warning)]',
    info: 'text-[var(--admin-color-info)]',
  }[tone ?? 'info'];
  return (
    <Card className={tone === 'danger' && value > 0 ? 'border-red-200' : undefined}>
      <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{formatAdminInteger(value)}</p>
    </Card>
  );
}

export function InventoryAlertsView({
  warehouses,
  inventory,
  selectedWarehouseId,
  warehousesFailed,
  inventoryFailed,
  notifications,
  notificationsFailed,
}: InventoryAlertsViewProps) {
  const router = useRouter();
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [demandQuery, setDemandQuery] = useState('');
  const [demandStatus, setDemandStatus] = useState('waiting');
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const monitoredInventory = useMemo(
    () => inventory.filter((item) => item.variantActive && item.productStatus === 'ACTIVE'),
    [inventory],
  );
  const outOfStock = monitoredInventory.filter((item) => item.available <= 0);
  const lowStock = monitoredInventory.filter((item) => item.available > 0 && item.isLowStock);
  const healthy = monitoredInventory.length - outOfStock.length - lowStock.length;
  const normalizedInventoryQuery = toAsciiDigits(inventoryQuery.trim()).toLocaleLowerCase('fa');
  const inventoryAlerts = useMemo(
    () =>
      monitoredInventory.filter((item) => {
        if (item.available > 0 && !item.isLowStock) return false;
        const haystack = `${item.productName} ${item.sku} ${variantLabel(item)}`.toLocaleLowerCase(
          'fa',
        );
        const matchesQuery =
          !normalizedInventoryQuery || haystack.includes(normalizedInventoryQuery);
        const matchesSeverity =
          severity === 'all' ||
          (severity === 'out' && item.available <= 0) ||
          (severity === 'low' && item.available > 0 && item.isLowStock);
        return matchesQuery && matchesSeverity;
      }),
    [monitoredInventory, normalizedInventoryQuery, severity],
  );
  const normalizedDemandQuery = toAsciiDigits(demandQuery.trim()).toLocaleLowerCase('fa');
  const demandTargets = useMemo(
    () =>
      (notifications?.targets ?? []).filter((target) => {
        const haystack =
          `${target.productName} ${target.sku ?? ''} ${targetLabel(target)}`.toLocaleLowerCase(
            'fa',
          );
        const matchesQuery = !normalizedDemandQuery || haystack.includes(normalizedDemandQuery);
        const matchesStatus =
          demandStatus === 'all' ||
          (demandStatus === 'waiting' && target.activeCount > 0) ||
          (demandStatus === 'queued' && target.queuedCount > 0) ||
          (demandStatus === 'notified' && target.notifiedCount > 0);
        return matchesQuery && matchesStatus;
      }),
    [demandStatus, normalizedDemandQuery, notifications?.targets],
  );
  const inventoryHref = selectedWarehouseId
    ? `/inventory?warehouse=${encodeURIComponent(selectedWarehouseId)}`
    : '/inventory';

  const inventoryColumns: readonly DataTableColumn<AdminInventoryItem>[] = [
    {
      id: 'product',
      header: 'محصول و تنوع',
      cell: (item) => (
        <div>
          <p className="font-bold">{item.productName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {variantLabel(item)} · {toPersianDigits(item.sku)}
          </p>
        </div>
      ),
    },
    {
      id: 'available',
      header: 'قابل فروش',
      cell: (item) => <strong className="text-base">{formatAdminInteger(item.available)}</strong>,
      align: 'center',
    },
    {
      id: 'reserved',
      header: 'رزرو',
      cell: (item) => formatAdminInteger(item.reserved),
      align: 'center',
    },
    {
      id: 'threshold',
      header: 'نقطه هشدار',
      cell: (item) => formatAdminInteger(item.lowStockThreshold),
      align: 'center',
    },
    { id: 'status', header: 'شدت', cell: alertBadge },
    {
      id: 'action',
      header: 'عملیات',
      cell: () => (
        <ButtonLink href={inventoryHref} variant="outline" size="sm">
          اصلاح موجودی
        </ButtonLink>
      ),
      align: 'end',
    },
  ];
  const demandColumns: readonly DataTableColumn<AdminStockNotificationTarget>[] = [
    {
      id: 'target',
      header: 'محصول و هدف درخواست',
      cell: (target) => (
        <div>
          <p className="font-bold">{target.productName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {targetLabel(target)}
            {target.sku ? ` · ${toPersianDigits(target.sku)}` : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'active',
      header: 'در انتظار',
      cell: (target) => <strong>{formatAdminInteger(target.activeCount)}</strong>,
      align: 'center',
    },
    {
      id: 'queued',
      header: 'صف ارسال',
      cell: (target) => formatAdminInteger(target.queuedCount),
      align: 'center',
    },
    {
      id: 'notified',
      header: 'ارسال‌شده',
      cell: (target) => formatAdminInteger(target.notifiedCount),
      align: 'center',
    },
    { id: 'status', header: 'وضعیت', cell: demandBadge },
    {
      id: 'action',
      header: 'عملیات',
      cell: (target) => (
        <ButtonLink href={`/products/${target.productId}/edit`} variant="outline" size="sm">
          مشاهده محصول
        </ButtonLink>
      ),
      align: 'end',
    },
  ];

  if (warehousesFailed) {
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت هشدارها ناموفق بود">
          فهرست انبارها از سرور دریافت نشد. صفحه را دوباره بارگذاری کنید.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
        <Card title="سلامت موجودی" description="تنوع‌های فعال محصول منتشرشده در انبار انتخاب‌شده">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 sm:max-w-sm">
              <Select
                value={selectedWarehouseId ?? undefined}
                onValueChange={(value) =>
                  router.push(`/inventory-alerts?warehouse=${encodeURIComponent(value)}`)
                }
                aria-label="انتخاب انبار هشدارها"
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: `${warehouse.name}${warehouse.isDefault ? ' — پیش‌فرض' : ''}`,
                }))}
                placeholder="انبار را انتخاب کنید"
              />
            </div>
            {selectedWarehouse ? (
              <Badge tone={selectedWarehouse.isActive ? 'success' : 'neutral'} dot>
                {selectedWarehouse.isActive ? 'انبار فعال' : 'انبار غیرفعال'}
              </Badge>
            ) : null}
          </div>
          {inventoryFailed ? (
            <Alert tone="danger">اطلاعات موجودی این انبار دریافت نشد.</Alert>
          ) : (
            <DonutChart
              title="توزیع سلامت موجودی"
              centerLabel="تنوع فعال"
              segments={[
                { label: 'موجودی مناسب', value: healthy, color: '#059669' },
                { label: 'کم‌موجود', value: lowStock.length, color: '#d97706' },
                { label: 'ناموجود', value: outOfStock.length, color: '#dc2626' },
              ]}
            />
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <Kpi label="ناموجود" value={outOfStock.length} tone="danger" />
          <Kpi label="کم‌موجود" value={lowStock.length} tone="warning" />
          <Kpi label="درخواست منتظر" value={notifications?.totals.active ?? 0} tone="warning" />
          <Kpi label="در صف اطلاع‌رسانی" value={notifications?.totals.queued ?? 0} tone="info" />
        </div>
      </div>

      <section aria-labelledby="inventory-alerts-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="inventory-alerts-heading" className="text-lg font-black">
              کالاهای نیازمند اقدام
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
              بر اساس موجودی قابل فروش و نقطه هشدار انبار
            </p>
          </div>
          <ButtonLink href={inventoryHref} variant="outline" size="sm">
            مدیریت انبار
          </ButtonLink>
        </div>
        <FilterBar
          activeCount={
            [normalizedInventoryQuery, severity === 'all' ? '' : severity].filter(Boolean).length
          }
          resetAction={
            normalizedInventoryQuery || severity !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInventoryQuery('');
                  setSeverity('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={inventoryQuery}
            onChange={(event) => setInventoryQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در محصول یا SKU"
            aria-label="جستجوی هشدار موجودی"
          />
          <Select
            value={severity}
            onValueChange={setSeverity}
            aria-label="فیلتر شدت هشدار"
            options={[
              { value: 'all', label: 'همه هشدارها' },
              { value: 'out', label: 'فقط ناموجود' },
              { value: 'low', label: 'فقط کم‌موجود' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های هشدار موجودی"
          renderMobileCard={(item) => (
            <MobileDataCard
              eyebrow={toPersianDigits(item.sku)}
              title={item.productName}
              status={alertBadge(item)}
              items={[
                { label: 'تنوع', value: variantLabel(item) },
                { label: 'قابل فروش', value: formatAdminInteger(item.available) },
                { label: 'رزرو', value: formatAdminInteger(item.reserved) },
                { label: 'نقطه هشدار', value: formatAdminInteger(item.lowStockThreshold) },
              ]}
              detailsTitle={item.productName}
              detailsDescription="جزئیات هشدار و دسترسی سریع به اصلاح موجودی"
              details={<InventoryAlertDetails item={item} inventoryHref={inventoryHref} />}
            />
          )}
          caption="هشدارهای کمبود موجودی"
          columns={inventoryColumns}
          rows={inventoryAlerts}
          getRowKey={(item) => item.variantId}
          error={
            inventoryFailed ? { description: 'دریافت هشدارهای موجودی ناموفق بود.' } : undefined
          }
          emptyTitle="هشدار موجودی ندارید"
          emptyDescription="تمام تنوع‌های فعال این انبار موجودی مناسبی دارند."
          compact
        />
      </section>

      <section aria-labelledby="notification-demand-heading" className="space-y-4">
        <div>
          <h2 id="notification-demand-heading" className="text-lg font-black">
            درخواست‌های اطلاع‌رسانی مشتریان
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            آمار تجمیعی تقاضا بدون نمایش اطلاعات شخصی مشتریان
          </p>
        </div>
        <FilterBar
          activeCount={
            [normalizedDemandQuery, demandStatus === 'all' ? '' : demandStatus].filter(Boolean)
              .length
          }
          resetAction={
            normalizedDemandQuery || demandStatus !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDemandQuery('');
                  setDemandStatus('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={demandQuery}
            onChange={(event) => setDemandQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در محصول یا SKU"
            aria-label="جستجوی درخواست اطلاع‌رسانی"
          />
          <Select
            value={demandStatus}
            onValueChange={setDemandStatus}
            aria-label="فیلتر وضعیت درخواست"
            options={[
              { value: 'all', label: 'همه درخواست‌ها' },
              { value: 'waiting', label: 'در انتظار موجودی' },
              { value: 'queued', label: 'در صف ارسال' },
              { value: 'notified', label: 'اطلاع‌رسانی‌شده' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های درخواست اطلاع‌رسانی"
          renderMobileCard={(target) => (
            <MobileDataCard
              eyebrow={target.sku ? toPersianDigits(target.sku) : 'کل محصول'}
              title={target.productName}
              status={demandBadge(target)}
              items={[
                { label: 'هدف', value: targetLabel(target) },
                { label: 'در انتظار', value: formatAdminInteger(target.activeCount) },
                { label: 'صف ارسال', value: formatAdminInteger(target.queuedCount) },
                { label: 'ارسال‌شده', value: formatAdminInteger(target.notifiedCount) },
              ]}
              detailsTitle={target.productName}
              detailsDescription="جزئیات تجمیعی درخواست‌های اطلاع‌رسانی"
              details={<DemandDetails target={target} />}
            />
          )}
          caption="درخواست‌های اطلاع‌رسانی موجودی"
          columns={demandColumns}
          rows={demandTargets}
          getRowKey={(target) => target.id}
          error={
            notificationsFailed
              ? { description: 'دریافت درخواست‌های اطلاع‌رسانی ناموفق بود.' }
              : undefined
          }
          emptyTitle="درخواستی پیدا نشد"
          emptyDescription="برای فیلتر انتخاب‌شده درخواست اطلاع‌رسانی وجود ندارد."
          compact
        />
      </section>
    </div>
  );
}
