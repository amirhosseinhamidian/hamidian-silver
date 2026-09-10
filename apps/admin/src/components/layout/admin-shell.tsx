'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { AdminProfileCompletionGate } from '@/components/auth/admin-profile-completion-gate';
import { AdminBrand } from '@/components/layout/admin-brand';
import { AdminIcon } from '@/components/layout/admin-icon';
import { AdminNavigationList } from '@/components/layout/admin-navigation-list';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  findAdminNavigationItem,
  isAdminNavigationItemActive,
  type AdminNavigationGroup,
  type AdminNavigationItem,
} from '@/lib/navigation/admin-navigation';
import { toPersianDigits } from '@/lib/presentation/formatters';
import type { AdminProfileIdentity } from '@/lib/profile/admin-profile-model';
import { cn } from '@/lib/ui/cn';

export type AdminShellAccount = Readonly<{
  phone: string;
  roleLabel: string;
  initials: string;
}>;

type AdminShellProps = Readonly<{
  children: ReactNode;
  account: AdminShellAccount;
  navigation: readonly AdminNavigationGroup[];
  profile: AdminProfileIdentity | null;
}>;

const MOBILE_QUICK_LINK_IDS = ['dashboard', 'orders', 'inventory', 'alerts'] as const;

function flattenNavigation(groups: readonly AdminNavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}

function getMobileQuickLinks(groups: readonly AdminNavigationGroup[]) {
  const items = flattenNavigation(groups);

  return MOBILE_QUICK_LINK_IDS.map((id) => items.find((item) => item.id === id)).filter(
    (item): item is AdminNavigationItem => Boolean(item),
  );
}

function AccountSummary({
  account,
  inverse = false,
}: Readonly<{
  account: AdminShellAccount;
  inverse?: boolean;
}>) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-xs font-black',
          inverse ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800',
        )}
      >
        {account.initials}
      </span>
      <span className="min-w-0 text-start">
        <span className={cn('block truncate text-sm font-bold', inverse && 'text-white')}>
          {account.roleLabel}
        </span>
        <span
          dir="ltr"
          className={cn(
            'mt-0.5 block truncate text-xs tabular-nums',
            inverse ? 'text-slate-400' : 'text-[var(--admin-color-muted)]',
          )}
        >
          {toPersianDigits(account.phone)}
        </span>
      </span>
    </div>
  );
}

function OperationalStatus({ inverse = false }: Readonly<{ inverse?: boolean }>) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold',
        inverse ? 'bg-white/[0.06] text-slate-300' : 'text-[var(--admin-color-muted)]',
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      اتصال مدیریتی فعال
    </div>
  );
}

export function AdminShell({ children, account, navigation, profile }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const currentItem = findAdminNavigationItem(pathname, navigation);
  const mobileQuickLinks = getMobileQuickLinks(navigation);

  async function logout() {
    if (logoutPending) return;

    setLogoutPending(true);
    setLogoutError('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout-failed');

      setLogoutConfirmationOpen(false);
      setMobileNavigationOpen(false);
      router.replace('/login');
      router.refresh();
    } catch {
      setLogoutError('خروج از حساب انجام نشد. دوباره تلاش کنید.');
      setLogoutPending(false);
    }
  }

  function requestLogout() {
    setLogoutError('');
    setMobileNavigationOpen(false);
    setLogoutConfirmationOpen(true);
  }

  return (
    <div data-app-shell="admin" className="min-h-dvh bg-[var(--admin-color-canvas)] lg:pr-72">
      <AdminProfileCompletionGate profile={profile} />
      <aside
        data-testid="desktop-admin-sidebar"
        className="fixed inset-y-0 right-0 z-40 hidden w-72 flex-col border-l border-slate-800 bg-slate-950 text-white lg:flex"
      >
        <div className="border-b border-white/10 px-5 py-5">
          <AdminBrand inverse />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
          <AdminNavigationList groups={navigation} pathname={pathname} appearance="dark" />
        </div>

        <div className="space-y-3 border-t border-white/10 p-4">
          <OperationalStatus inverse />
          <AccountSummary account={account} inverse />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--admin-color-border)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <IconButton
              label="بازکردن منوی مدیریت"
              variant="ghost"
              onClick={() => setMobileNavigationOpen(true)}
              className="shrink-0 lg:hidden"
            >
              <AdminIcon name="menu" />
            </IconButton>

            <div className="lg:hidden">
              <AdminBrand />
            </div>

            <nav
              aria-label="مسیر صفحه"
              className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"
            >
              {pathname === '/' ? (
                <span className="truncate text-sm font-bold text-[var(--admin-color-ink)]">
                  داشبورد عملیات
                </span>
              ) : (
                <>
                  <Link
                    href="/"
                    className="rounded text-sm text-[var(--admin-color-muted)] outline-none hover:text-[var(--admin-color-ink)] focus-visible:shadow-[var(--admin-focus-ring)]"
                  >
                    پنل مدیریت
                  </Link>
                  <AdminIcon name="chevron-left" className="size-4 text-slate-400" />
                  <span className="truncate text-sm font-bold text-[var(--admin-color-ink)]">
                    {currentItem?.label ?? 'بخش مدیریت'}
                  </span>
                </>
              )}
            </nav>

            <div className="ms-auto hidden md:block lg:ms-0">
              <OperationalStatus />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="منوی حساب مدیر"
                  className="ms-auto flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-color-border)] bg-white px-2 outline-none transition-colors hover:bg-[var(--admin-color-surface-hover)] focus-visible:shadow-[var(--admin-focus-ring)] lg:ms-0"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-[0.65rem] font-black text-slate-800">
                    {account.initials}
                  </span>
                  <span className="hidden max-w-28 truncate text-xs font-bold sm:block">
                    {account.roleLabel}
                  </span>
                  <AdminIcon
                    name="chevron-left"
                    className="size-3.5 rotate-[-90deg] text-slate-500"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>
                  <AccountSummary account={account} />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={logoutPending}
                  tone="danger"
                  icon={<AdminIcon name="logout" className="size-4" />}
                  onSelect={requestLogout}
                >
                  {logoutPending ? 'در حال خروج…' : 'خروج از حساب'}
                </DropdownMenuItem>
                {logoutError ? (
                  <p role="alert" className="px-2.5 py-2 text-xs leading-5 text-red-700">
                    {logoutError}
                  </p>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="min-w-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>
      </div>

      <nav
        data-testid="mobile-admin-navigation"
        aria-label="دسترسی سریع مدیریت"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-color-border)] bg-white/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(16_24_40/0.08)] backdrop-blur lg:hidden"
      >
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{ gridTemplateColumns: `repeat(${mobileQuickLinks.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileQuickLinks.map((item) => {
            const active = isAdminNavigationItemActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.65rem] font-bold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)]',
                  active
                    ? 'bg-[var(--admin-color-primary-soft)] text-[var(--admin-color-primary)]'
                    : 'text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)]',
                )}
              >
                <AdminIcon name={item.icon} className="size-5" />
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="نمایش همه بخش‌های مدیریت"
            onClick={() => setMobileNavigationOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.65rem] font-bold text-[var(--admin-color-muted)] outline-none transition-colors hover:bg-[var(--admin-color-surface-hover)] focus-visible:shadow-[var(--admin-focus-ring)]"
          >
            <AdminIcon name="more" className="size-5" />
            <span>بیشتر</span>
          </button>
        </div>
      </nav>

      <DialogPrimitive.Root open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="admin-drawer-overlay fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby="admin-mobile-navigation-description"
            className="admin-drawer-content fixed inset-y-0 right-0 z-[51] flex w-[min(88vw,22rem)] flex-col border-l border-slate-800 bg-slate-950 text-white shadow-[var(--admin-shadow-lg)] outline-none lg:hidden"
          >
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4">
              <DialogPrimitive.Title className="sr-only">منوی مدیریت</DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="admin-mobile-navigation-description"
                className="sr-only"
              >
                دسترسی به بخش‌های مجاز پنل مدیریت
              </DialogPrimitive.Description>
              <AdminBrand inverse />
              <DialogPrimitive.Close asChild>
                <IconButton
                  label="بستن منوی مدیریت"
                  variant="ghost"
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <AdminIcon name="close" />
                </IconButton>
              </DialogPrimitive.Close>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
              <AdminNavigationList
                groups={navigation}
                pathname={pathname}
                appearance="dark"
                onNavigate={() => setMobileNavigationOpen(false)}
              />
            </div>

            <footer className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <AccountSummary account={account} inverse />
              {logoutError ? (
                <p role="alert" className="mt-3 text-xs leading-5 text-red-300">
                  {logoutError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={logoutPending}
                onClick={requestLogout}
                className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-bold text-slate-200 outline-none transition-colors hover:bg-white/10 focus-visible:shadow-[var(--admin-focus-ring)] disabled:cursor-default disabled:opacity-50"
              >
                <AdminIcon name="logout" className="size-4" />
                {logoutPending ? 'در حال خروج…' : 'خروج از حساب'}
              </button>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Dialog
        open={logoutConfirmationOpen}
        onOpenChange={(open) => !logoutPending && setLogoutConfirmationOpen(open)}
      >
        <DialogContent
          size="sm"
          title="خروج از حساب کاربری"
          description="پس از خروج، برای دسترسی دوباره به پنل مدیریت باید وارد شوید."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={logoutPending}>
                  انصراف
                </Button>
              </DialogClose>
              <Button variant="danger" loading={logoutPending} onClick={() => void logout()}>
                تأیید خروج
              </Button>
            </>
          }
        >
          <p className="text-sm leading-7 text-[var(--admin-color-muted)]">
            آیا مطمئن هستید که می‌خواهید از حساب مدیریتی خود خارج شوید؟
          </p>
          {logoutError ? (
            <p role="alert" className="mt-3 text-sm leading-6 text-red-700">
              {logoutError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
