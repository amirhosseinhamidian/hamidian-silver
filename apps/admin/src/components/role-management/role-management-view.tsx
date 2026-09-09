'use client';

import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SearchField } from '@/components/ui/filter-bar';
import type { AdminPermission, AdminRole } from '@/lib/auth/access-control';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import {
  parseRoleManagementSnapshot,
  type ManagedPermission,
  type ManagedRolePolicy,
  type RoleManagementSnapshot,
} from '@/lib/role-management/role-management-model';

type Props = Readonly<{
  snapshot: RoleManagementSnapshot;
  failed: boolean;
  canManage: boolean;
}>;

const ROLE_META: Record<AdminRole, Readonly<{ label: string; tone: BadgeTone }>> = {
  MANAGER: { label: 'مدیر ارشد', tone: 'danger' },
  ADMIN: { label: 'ادمین عملیات', tone: 'info' },
  USER: { label: 'مشتری', tone: 'neutral' },
};

const GROUPS: readonly Readonly<{
  label: string;
  description: string;
  prefix: string;
}>[] = [
  { label: 'کاتالوگ', description: 'محصول، دسته‌بندی و برند', prefix: 'catalog.' },
  { label: 'موجودی', description: 'انبار و گردش موجودی', prefix: 'inventory.' },
  { label: 'سفارش', description: 'مشاهده و عملیات سفارش', prefix: 'orders.' },
  { label: 'محتوا', description: 'محتوای سایت و صفحات', prefix: 'cms.' },
  { label: 'قیمت‌گذاری', description: 'قیمت فروش و قواعد قیمت', prefix: 'pricing.' },
  { label: 'مالی', description: 'گزارش‌ها، بدهی و تسویه', prefix: 'finance.' },
  { label: 'تنظیمات', description: 'تنظیمات حساس سامانه', prefix: 'settings.' },
  { label: 'کاربران', description: 'حساب، نقش و دسترسی', prefix: 'users.' },
  { label: 'گزارش فعالیت', description: 'رویدادهای حساس', prefix: 'audit.' },
];

const LABELS: Partial<Record<AdminPermission, string>> = {
  'catalog.read': 'مشاهده کاتالوگ',
  'catalog.write': 'مدیریت کاتالوگ',
  'inventory.read': 'مشاهده موجودی',
  'inventory.write': 'مدیریت موجودی',
  'orders.read': 'مشاهده سفارش‌ها',
  'orders.status.write': 'تغییر وضعیت سفارش',
  'orders.tracking.write': 'مدیریت رهگیری',
  'orders.cancel': 'لغو سفارش',
  'cms.read': 'مشاهده محتوا',
  'cms.write': 'مدیریت محتوا',
  'pricing.read': 'مشاهده قیمت‌گذاری',
  'pricing.write': 'مدیریت قیمت‌گذاری',
  'finance.read': 'مشاهده اطلاعات مالی',
  'finance.write': 'عملیات مالی',
  'settings.read': 'مشاهده تنظیمات',
  'settings.write': 'مدیریت تنظیمات',
  'users.read': 'مشاهده کاربران',
  'users.write': 'مدیریت کاربران',
  'audit.read': 'مشاهده گزارش فعالیت',
};

const DEPENDENCIES: Partial<Record<AdminPermission, AdminPermission>> = {
  'catalog.write': 'catalog.read',
  'inventory.write': 'inventory.read',
  'orders.status.write': 'orders.read',
  'orders.tracking.write': 'orders.read',
  'orders.cancel': 'orders.read',
  'cms.write': 'cms.read',
  'pricing.write': 'pricing.read',
  'finance.write': 'finance.read',
  'settings.write': 'settings.read',
  'users.write': 'users.read',
};

const DEFAULT_ADMIN: readonly AdminPermission[] = [
  'catalog.read',
  'catalog.write',
  'inventory.read',
  'inventory.write',
  'orders.read',
  'orders.status.write',
  'orders.tracking.write',
  'cms.read',
  'cms.write',
];

function permissionLabel(permission: ManagedPermission): string {
  return LABELS[permission.code] ?? permission.name;
}

function RoleBadge({ role }: Readonly<{ role: ManagedRolePolicy }>) {
  const meta = ROLE_META[role.code];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function PermissionState({ granted }: Readonly<{ granted: boolean }>) {
  return (
    <span
      aria-label={granted ? 'دارد' : 'ندارد'}
      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-black ${
        granted
          ? 'bg-[var(--admin-color-success-soft)] text-[var(--admin-color-success)]'
          : 'bg-[var(--admin-color-canvas)] text-[var(--admin-color-muted)]'
      }`}
    >
      {granted ? '✓' : '—'}
    </span>
  );
}

function errorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'فقط مدیر ارشد می‌تواند permissionهای نقش را تغییر دهد.';
  if (status === 404) return 'نقش موردنظر پیدا نشد.';
  if (status === 400 || status === 422)
    return 'ترکیب دسترسی‌ها معتبر نیست؛ دسترسی نوشتن به دسترسی مشاهده همان بخش نیاز دارد.';
  return 'ذخیره سیاست دسترسی انجام نشد. دوباره تلاش کنید.';
}

export function RoleManagementView({ snapshot, failed, canManage }: Props) {
  const [roles, setRoles] = useState(snapshot.roles);
  const [selectedCode, setSelectedCode] = useState<AdminRole>('ADMIN');
  const admin = roles.find((role) => role.code === 'ADMIN');
  const [draft, setDraft] = useState<AdminPermission[]>([...(admin?.permissionCodes ?? [])]);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = roles.find((role) => role.code === selectedCode) ?? roles[0];
  const granted = selectedCode === 'ADMIN' ? draft : (selected?.permissionCodes ?? []);
  const changed = Boolean(
    admin &&
    (draft.length !== admin.permissionCodes.length ||
      draft.some((code) => !admin.permissionCodes.includes(code))),
  );
  const filteredPermissions = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fa');
    if (!needle) return snapshot.permissions;
    return snapshot.permissions.filter((permission) =>
      [permission.code, permission.name, permissionLabel(permission)].some((value) =>
        value.toLocaleLowerCase('fa').includes(needle),
      ),
    );
  }, [search, snapshot.permissions]);

  function togglePermission(code: AdminPermission, checked: boolean) {
    setError('');
    setSuccess('');
    setDraft((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(code);
        const required = DEPENDENCIES[code];
        if (required) next.add(required);
      } else {
        next.delete(code);
        Object.entries(DEPENDENCIES).forEach(([write, read]) => {
          if (read === code) next.delete(write as AdminPermission);
        });
      }
      return [...next].sort();
    });
  }

  async function save() {
    if (!canManage || !changed || pending || draft.length === 0) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/admin-roles/ADMIN/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionCodes: draft }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(errorMessage(response.status));
      const next = parseRoleManagementSnapshot(payload);
      if (!next) throw new Error('پاسخ سرویس مدیریت نقش‌ها معتبر نیست.');
      setRoles(next.roles);
      setDraft([...(next.roles.find((role) => role.code === 'ADMIN')?.permissionCodes ?? [])]);
      setConfirming(false);
      setSuccess('سیاست نقش ادمین ذخیره و نشست کاربران متاثر باطل شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره سیاست دسترسی انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  if (failed)
    return (
      <Alert tone="danger" title="اطلاعات نقش‌ها دریافت نشد">
        اتصال API و مجوز `users.read` را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );

  return (
    <div className="space-y-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!canManage ? (
        <Alert tone="info">
          این صفحه فقط‌خواندنی است؛ تغییر permissionها فقط توسط Manager دارای `users.write` انجام
          می‌شود.
        </Alert>
      ) : null}
      <Alert tone="warning" title="نقش‌های پایه محافظت می‌شوند">
        دسترسی Manager و User ثابت است. هر تغییر نقش Admin نشست کاربران این نقش را باطل می‌کند.
      </Alert>

      <section aria-label="خلاصه نقش‌ها" className="grid gap-3 sm:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.code}>
            <div className="flex items-center justify-between gap-3">
              <RoleBadge role={role} />
              <Badge tone={role.isEditable ? 'warning' : 'neutral'}>
                {role.isEditable ? 'قابل ویرایش' : 'محافظت‌شده'}
              </Badge>
            </div>
            <p className="mt-4 text-2xl font-black">
              {formatAdminInteger(role.permissionCodes.length)}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">permission فعال</p>
            <p className="mt-3 text-xs text-[var(--admin-color-muted)]">
              {formatAdminInteger(role.assignedUserCount)} کاربر منتسب
            </p>
          </Card>
        ))}
      </section>

      <Card
        title="ماتریس دسترسی‌ها"
        description="دسترسی نوشتن به‌صورت خودکار دسترسی مشاهده همان بخش را نیز فعال می‌کند."
        action={
          <SearchField
            aria-label="جستجوی دسترسی"
            placeholder="جستجوی permission"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-color-border)] text-right">
                <th className="p-3 font-bold">دسترسی</th>
                {roles.map((role) => (
                  <th key={role.code} className="p-3 text-center font-bold">
                    {ROLE_META[role.code].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.map((permission) => (
                <tr key={permission.code} className="border-b border-[var(--admin-color-border)]">
                  <td className="p-3">
                    <p className="font-semibold">{permissionLabel(permission)}</p>
                    <code className="mt-1 block text-xs text-[var(--admin-color-muted)]" dir="ltr">
                      {permission.code}
                    </code>
                  </td>
                  {roles.map((role) => {
                    const checked =
                      role.code === 'ADMIN'
                        ? draft.includes(permission.code)
                        : role.permissionCodes.includes(permission.code);
                    return (
                      <td key={role.code} className="p-3 text-center">
                        {role.code === 'ADMIN' && canManage ? (
                          <input
                            type="checkbox"
                            aria-label={`${permissionLabel(permission)} برای ادمین عملیات`}
                            checked={checked}
                            onChange={(event) =>
                              togglePermission(permission.code, event.target.checked)
                            }
                            className="size-4 accent-[var(--admin-color-primary)]"
                          />
                        ) : (
                          <PermissionState granted={checked} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {roles.map((role) => (
              <Button
                key={role.code}
                size="sm"
                variant={selectedCode === role.code ? 'primary' : 'outline'}
                onClick={() => setSelectedCode(role.code)}
              >
                {ROLE_META[role.code].label}
              </Button>
            ))}
          </div>
          {GROUPS.map((group) => {
            const items = filteredPermissions.filter((permission) =>
              permission.code.startsWith(group.prefix),
            );
            if (!items.length) return null;
            return (
              <section
                key={group.prefix}
                className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
              >
                <h3 className="font-bold">{group.label}</h3>
                <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{group.description}</p>
                <div className="mt-4 space-y-4">
                  {items.map((permission) => (
                    <Checkbox
                      key={permission.code}
                      id={`mobile-${selectedCode}-${permission.code}`}
                      label={permissionLabel(permission)}
                      description={permission.code}
                      checked={granted.includes(permission.code)}
                      disabled={selectedCode !== 'ADMIN' || !canManage}
                      onChange={(event) => togglePermission(permission.code, event.target.checked)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {canManage ? (
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-color-border)] pt-4">
            <Button variant="ghost" disabled={pending} onClick={() => setDraft([...DEFAULT_ADMIN])}>
              بازگردانی پیش‌فرض
            </Button>
            <Button
              variant="outline"
              disabled={!changed || pending}
              onClick={() => setDraft([...(admin?.permissionCodes ?? [])])}
            >
              لغو تغییرات
            </Button>
            <Button
              disabled={!changed || draft.length === 0 || pending}
              onClick={() => setConfirming(true)}
            >
              ذخیره سیاست دسترسی
            </Button>
          </div>
        ) : null}
      </Card>

      <Dialog open={confirming} onOpenChange={(open) => !open && !pending && setConfirming(false)}>
        <DialogContent
          title="تأیید تغییر دسترسی نقش ادمین"
          description={`${formatAdminInteger(admin?.assignedUserCount ?? 0)} کاربر تحت تأثیر قرار می‌گیرد.`}
          hideClose={pending}
          footer={
            <>
              <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
                انصراف
              </Button>
              <Button loading={pending} onClick={save}>
                ثبت و ابطال نشست‌ها
              </Button>
            </>
          }
        >
          <Alert tone="warning">
            پس از ثبت، کاربران دارای نقش Admin باید دوباره وارد شوند تا سیاست جدید روی نشست تازه
            اعمال شود.
          </Alert>
        </DialogContent>
      </Dialog>
    </div>
  );
}
