'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { AdminPermission, AdminRole } from '@/lib/auth/access-control';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import {
  parseManagedUser,
  type ManagedRole,
  type ManagedUser,
  type ManagedUserRole,
  type UserManagementSnapshot,
} from '@/lib/user-management/user-management-model';

type Props = Readonly<{
  snapshot: UserManagementSnapshot;
  failed: boolean;
  currentUserId: string;
  canWrite: boolean;
}>;
type StatusFilter = 'all' | 'active' | 'inactive';
type RoleFilter = 'all' | AdminRole;
type DetailMode = 'desktop' | 'mobile' | null;
type Action =
  | Readonly<{ kind: 'roles'; user: ManagedUser }>
  | Readonly<{ kind: 'status'; user: ManagedUser }>
  | Readonly<{ kind: 'sessions'; user: ManagedUser }>;

const ROLE: Record<AdminRole, Readonly<{ label: string; tone: BadgeTone }>> = {
  MANAGER: { label: 'مدیر ارشد', tone: 'danger' },
  ADMIN: { label: 'ادمین عملیات', tone: 'info' },
  USER: { label: 'مشتری', tone: 'neutral' },
};

const PERMISSION_GROUPS: readonly Readonly<{
  label: string;
  prefix: string;
}>[] = [
  { label: 'کاتالوگ', prefix: 'catalog.' },
  { label: 'موجودی', prefix: 'inventory.' },
  { label: 'سفارش‌ها', prefix: 'orders.' },
  { label: 'محتوا', prefix: 'cms.' },
  { label: 'قیمت‌گذاری', prefix: 'pricing.' },
  { label: 'مالی', prefix: 'finance.' },
  { label: 'تنظیمات', prefix: 'settings.' },
  { label: 'کاربران', prefix: 'users.' },
  { label: 'گزارش فعالیت', prefix: 'audit.' },
];

function userName(user: ManagedUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر بدون نام';
}

function RoleBadges({ roles }: Readonly<{ roles: readonly ManagedUserRole[] }>) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role.code} tone={ROLE[role.code].tone}>
          {ROLE[role.code].label}
        </Badge>
      ))}
    </div>
  );
}

function StatusBadge({ active }: Readonly<{ active: boolean }>) {
  return (
    <Badge tone={active ? 'success' : 'neutral'} dot>
      {active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string])[] }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 text-xs sm:text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[68%] text-left font-semibold break-words">
            {toPersianDigits(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Permissions({ permissions }: Readonly<{ permissions: readonly AdminPermission[] }>) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => {
        const items = permissions.filter((permission) => permission.startsWith(group.prefix));
        if (!items.length) return null;
        return (
          <div
            key={group.prefix}
            className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
          >
            <p className="text-xs font-bold">{group.label}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {items.map((item) => (
                <Badge key={item} tone="neutral">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
      {!permissions.length ? (
        <p className="text-sm text-[var(--admin-color-muted)]">دسترسی مدیریتی ندارد.</p>
      ) : null}
    </div>
  );
}

function UserDetails({ user }: Readonly<{ user: ManagedUser }>) {
  return (
    <div className="space-y-4">
      <Card title="مشخصات حساب">
        <DetailRows
          rows={[
            ['نام', userName(user)],
            ['شماره موبایل', formatAdminPhone(user.phone)],
            ['وضعیت', user.isActive ? 'فعال' : 'غیرفعال'],
            [
              'تأیید موبایل',
              user.phoneVerifiedAt ? formatAdminDateTime(user.phoneVerifiedAt) : 'تأیید نشده',
            ],
            [
              'آخرین ورود',
              user.lastLoginAt ? formatAdminDateTime(user.lastLoginAt) : 'ورودی ثبت نشده',
            ],
            ['نشست فعال', formatAdminInteger(user.activeSessionCount)],
            ['عضویت', formatAdminDateTime(user.createdAt)],
            ['آخرین تغییر', formatAdminDateTime(user.updatedAt)],
          ]}
        />
      </Card>
      <Card
        title="نقش‌ها"
        description="دسترسی مؤثر از اجتماع permissionهای نقش‌های فعال به‌دست می‌آید."
      >
        <div className="space-y-3">
          <RoleBadges roles={user.roles} />
          {user.roles.map((role) => (
            <p key={role.code} className="text-xs text-[var(--admin-color-muted)]">
              {ROLE[role.code].label} از {formatAdminDateTime(role.assignedAt)}
            </p>
          ))}
        </div>
      </Card>
      <Card title="دسترسی مؤثر">
        <Permissions permissions={user.effectivePermissions} />
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: Readonly<{ label: string; value: number; tone: BadgeTone }>) {
  return (
    <Card>
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-2xl font-black">{formatAdminInteger(value)}</p>
    </Card>
  );
}

function errorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز مدیریت کاربران را ندارید.';
  if (status === 404) return 'کاربر یا نقش موردنظر پیدا نشد.';
  if (status === 409)
    return 'این عملیات آخرین مدیر فعال سامانه را حذف می‌کند یا وضعیت هم‌زمان تغییر کرده است.';
  if (status === 400 || status === 422)
    return 'عملیات برای این حساب مجاز نیست یا اطلاعات نقش‌ها معتبر نیست.';
  return 'عملیات مدیریت کاربر انجام نشد. دوباره تلاش کنید.';
}

export function UserManagementView({ snapshot, failed, currentUserId, canWrite }: Props) {
  const [users, setUsers] = useState(snapshot.users);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [role, setRole] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [roleCodes, setRoleCodes] = useState<AdminRole[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        if (status === 'active' && !user.isActive) return false;
        if (status === 'inactive' && user.isActive) return false;
        if (role !== 'all' && !user.roles.some((item) => item.code === role)) return false;
        if (!needle) return true;
        return [
          userName(user),
          user.phone,
          ...user.roles.map((item) => ROLE[item.code].label),
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [needle, role, status, users],
  );

  const totals = useMemo(
    () => ({
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
      privileged: users.filter((user) =>
        user.roles.some((item) => item.code === 'ADMIN' || item.code === 'MANAGER'),
      ).length,
      sessions: users.reduce((sum, user) => sum + user.activeSessionCount, 0),
    }),
    [users],
  );

  function openDetails(user: ManagedUser, mode: Exclude<DetailMode, null>) {
    setSelected(user);
    setDetailMode(mode);
  }

  function closeDetails() {
    setSelected(null);
    setDetailMode(null);
  }

  function openAction(next: Action) {
    if (next.user.id === currentUserId) return;
    closeDetails();
    setAction(next);
    setError('');
    setSuccess('');
    setRoleCodes(next.user.roles.map((item) => item.code));
  }

  function closeAction() {
    if (!pending) {
      setAction(null);
      setError('');
    }
  }

  function updateUser(next: ManagedUser) {
    setUsers((current) => current.map((user) => (user.id === next.id ? next : user)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    if (action.kind === 'roles' && !roleCodes.length) {
      setError('حداقل یک نقش باید انتخاب شود.');
      return;
    }
    const endpoint =
      action.kind === 'roles'
        ? `/api/admin-users/${encodeURIComponent(action.user.id)}/roles`
        : action.kind === 'status'
          ? `/api/admin-users/${encodeURIComponent(action.user.id)}/status`
          : `/api/admin-users/${encodeURIComponent(action.user.id)}/sessions/revoke`;
    const method = action.kind === 'roles' ? 'PUT' : action.kind === 'status' ? 'PATCH' : 'POST';
    const body =
      action.kind === 'roles'
        ? { roleCodes }
        : action.kind === 'status'
          ? { isActive: !action.user.isActive }
          : undefined;
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(errorMessage(response.status));
      if (action.kind === 'sessions') {
        setUsers((current) =>
          current.map((user) =>
            user.id === action.user.id ? { ...user, activeSessionCount: 0 } : user,
          ),
        );
        setSuccess('نشست‌های فعال کاربر باطل شدند.');
      } else {
        const updated = parseManagedUser(payload);
        if (!updated) throw new Error('پاسخ سرویس مدیریت کاربران معتبر نیست.');
        updateUser(updated);
        setSuccess(
          action.kind === 'roles'
            ? 'نقش‌ها ذخیره و نشست‌های قبلی باطل شدند.'
            : updated.isActive
              ? 'حساب کاربر فعال شد.'
              : 'حساب کاربر غیرفعال و نشست‌هایش باطل شد.',
        );
      }
      setAction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'عملیات مدیریت کاربر انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<ManagedUser>[] = [
    {
      id: 'identity',
      header: 'کاربر',
      cell: (user) => (
        <div>
          <p className="font-bold">{userName(user)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]" dir="ltr">
            {formatAdminPhone(user.phone)}
          </p>
        </div>
      ),
    },
    { id: 'status', header: 'وضعیت', cell: (user) => <StatusBadge active={user.isActive} /> },
    { id: 'roles', header: 'نقش‌ها', cell: (user) => <RoleBadges roles={user.roles} /> },
    {
      id: 'permissions',
      header: 'دسترسی',
      visibility: 'lg',
      cell: (user) => `${formatAdminInteger(user.effectivePermissions.length)} permission`,
    },
    {
      id: 'sessions',
      header: 'نشست فعال',
      visibility: 'lg',
      cell: (user) => formatAdminInteger(user.activeSessionCount),
    },
    {
      id: 'login',
      header: 'آخرین ورود',
      visibility: 'lg',
      cell: (user) => (user.lastLoginAt ? formatAdminDateTime(user.lastLoginAt) : 'ثبت نشده'),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (user) => (
        <Button size="sm" variant="outline" onClick={() => openDetails(user, 'desktop')}>
          جزئیات
        </Button>
      ),
    },
  ];

  const activeFilters = Number(Boolean(needle)) + Number(status !== 'all') + Number(role !== 'all');
  const detailFooter =
    selected && canWrite && selected.id !== currentUserId ? (
      <div className="flex w-full flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openAction({ kind: 'roles', user: selected })}
        >
          ویرایش نقش‌ها
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.activeSessionCount}
          onClick={() => openAction({ kind: 'sessions', user: selected })}
        >
          ابطال نشست‌ها
        </Button>
        <Button
          size="sm"
          variant={selected.isActive ? 'danger' : 'primary'}
          onClick={() => openAction({ kind: 'status', user: selected })}
        >
          {selected.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
        </Button>
      </div>
    ) : undefined;

  if (failed)
    return (
      <Alert tone="danger" title="اطلاعات کاربران دریافت نشد">
        اتصال API و مجوز `users.read` را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );

  return (
    <div className="space-y-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ عملیات مدیریتی به `users.write` نیاز دارد.
        </Alert>
      ) : null}
      <Alert tone="warning" title="کنترل‌های جلوگیری از قفل‌شدن دسترسی فعال‌اند">
        تغییر نقش یا غیرفعال‌کردن حساب خود و حذف آخرین Manager فعال مجاز نیست.
      </Alert>

      <section aria-label="شاخص‌های کاربران" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="کاربر فعال" value={totals.active} tone="success" />
        <Kpi
          label="کاربر غیرفعال"
          value={totals.inactive}
          tone={totals.inactive ? 'warning' : 'neutral'}
        />
        <Kpi label="حساب مدیریتی" value={totals.privileged} tone="info" />
        <Kpi label="نشست فعال" value={totals.sessions} tone="neutral" />
      </section>

      <Card title="ترکیب وضعیت حساب‌ها" description="تعداد حساب‌های فعال و غیرفعال">
        <DonutChart
          title="ترکیب وضعیت کاربران"
          segments={[
            { label: 'فعال', value: totals.active, color: 'var(--admin-color-success)' },
            { label: 'غیرفعال', value: totals.inactive, color: 'var(--admin-color-muted)' },
          ]}
        />
      </Card>

      <FilterBar
        activeCount={activeFilters}
        resetAction={
          activeFilters ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setRole('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی کاربر"
          placeholder="نام، موبایل یا نقش"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت کاربر"
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            { value: 'active', label: 'فعال' },
            { value: 'inactive', label: 'غیرفعال' },
          ]}
        />
        <Select
          aria-label="فیلتر نقش کاربر"
          value={role}
          onValueChange={(value) => setRole(value as RoleFilter)}
          options={[
            { value: 'all', label: 'همه نقش‌ها' },
            ...snapshot.roles.map((item) => ({ value: item.code, label: ROLE[item.code].label })),
          ]}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="فهرست کاربران و دسترسی‌ها"
        mobileLabel="کارت‌های کاربران"
        columns={columns}
        rows={filtered}
        getRowKey={(user) => user.id}
        emptyTitle={activeFilters ? 'کاربری پیدا نشد' : 'کاربری ثبت نشده است'}
        emptyDescription="عبارت جستجو یا فیلترها را تغییر دهید."
        renderMobileCard={(user) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === user.id}
            onDetailsOpenChange={(open) => (open ? openDetails(user, 'mobile') : closeDetails())}
            title={userName(user)}
            eyebrow={formatAdminPhone(user.phone)}
            status={<StatusBadge active={user.isActive} />}
            items={[
              { label: 'نقش', value: user.roles.map((item) => ROLE[item.code].label).join('، ') },
              { label: 'دسترسی', value: formatAdminInteger(user.effectivePermissions.length) },
              { label: 'نشست فعال', value: formatAdminInteger(user.activeSessionCount) },
              {
                label: 'آخرین ورود',
                value: user.lastLoginAt ? formatAdminDateTime(user.lastLoginAt) : 'ثبت نشده',
              },
            ]}
            detailsTitle={userName(user)}
            detailsDescription={formatAdminPhone(user.phone)}
            details={<UserDetails user={user} />}
            detailsFooter={detailFooter}
          />
        )}
      />

      <Card title="کاتالوگ نقش‌ها" description="نقش‌های سیستمی و permissionهای اعطاشده">
        <div className="grid gap-3 lg:grid-cols-3">
          {snapshot.roles.map((item) => (
            <article
              key={item.code}
              className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
            >
              <RoleBadges
                roles={[
                  {
                    code: item.code,
                    name: item.name,
                    assignedAt: new Date(0).toISOString(),
                    permissions: item.permissions.map((permission) => permission.code),
                  },
                ]}
              />
              <p className="mt-2 text-xs leading-5 text-[var(--admin-color-muted)]">
                {item.description ?? 'بدون توضیح'}
              </p>
              <p className="mt-3 text-xs font-bold">
                {formatAdminInteger(item.permissions.length)} permission
              </p>
            </article>
          ))}
        </div>
      </Card>

      <Dialog open={detailMode === 'desktop'} onOpenChange={(open) => !open && closeDetails()}>
        {selected ? (
          <DialogContent
            size="lg"
            title={userName(selected)}
            description={formatAdminPhone(selected.phone)}
            footer={detailFooter}
          >
            <UserDetails user={selected} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={action !== null} onOpenChange={(open) => !open && closeAction()}>
        {action ? (
          <DialogContent
            title={
              action.kind === 'roles'
                ? 'ویرایش نقش‌های کاربر'
                : action.kind === 'sessions'
                  ? 'ابطال نشست‌های فعال'
                  : action.user.isActive
                    ? 'غیرفعال‌سازی حساب'
                    : 'فعال‌سازی حساب'
            }
            description={`${userName(action.user)} · ${formatAdminPhone(action.user.phone)}`}
            hideClose={pending}
            footer={
              <>
                <Button variant="outline" disabled={pending} onClick={closeAction}>
                  انصراف
                </Button>
                <Button
                  type="submit"
                  form="user-management-action"
                  variant={
                    action.kind !== 'roles' && (action.kind === 'sessions' || action.user.isActive)
                      ? 'danger'
                      : 'primary'
                  }
                  loading={pending}
                >
                  تأیید نهایی
                </Button>
              </>
            }
          >
            <form id="user-management-action" className="space-y-4" onSubmit={submit}>
              {action.kind === 'roles' ? (
                <div className="space-y-3">
                  <Alert tone="warning">
                    پس از ذخیره نقش‌ها، نشست‌های فعلی کاربر باطل می‌شوند و ورود دوباره لازم است.
                  </Alert>
                  {snapshot.roles.map((item: ManagedRole) => (
                    <Checkbox
                      key={item.code}
                      id={`role-${item.code}`}
                      disabled={pending}
                      label={ROLE[item.code].label}
                      description={`${item.permissions.length} permission · ${item.description ?? ''}`}
                      checked={roleCodes.includes(item.code)}
                      onChange={(event) =>
                        setRoleCodes((current) =>
                          event.target.checked
                            ? [...current, item.code]
                            : current.filter((code) => code !== item.code),
                        )
                      }
                    />
                  ))}
                </div>
              ) : action.kind === 'sessions' ? (
                <Alert tone="danger" title="همه نشست‌های فعال باطل می‌شوند">
                  کاربر برای ادامه استفاده از حساب باید دوباره وارد شود.
                </Alert>
              ) : (
                <Alert
                  tone={action.user.isActive ? 'danger' : 'warning'}
                  title={
                    action.user.isActive
                      ? 'حساب و نشست‌ها غیرفعال می‌شوند'
                      : 'ورود دوباره کاربر مجاز می‌شود'
                  }
                >
                  {action.user.isActive
                    ? 'پس از تأیید، همه نشست‌های فعلی نیز باطل خواهند شد.'
                    : 'نقش‌ها و دسترسی‌های قبلی حساب دوباره مؤثر می‌شوند.'}
                </Alert>
              )}
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
