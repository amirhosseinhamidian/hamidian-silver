'use client';

import { useEffect, useRef, useState } from 'react';

import type { KeyboardEvent } from 'react';

import { AccountAddressesPanel } from '@/components/account/account-addresses-panel';
import { AccountOrdersPanel } from '@/components/account/account-orders-panel';
import { AccountProfilePanel } from '@/components/account/account-profile-panel';
import type {
  CustomerAddress,
  CustomerOrder,
  CustomerOrderList,
  CustomerProfile,
} from '@/components/account/account-types';
import { toPersianDigits } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTHENTICATION_SUCCEEDED_EVENT, openAuthModal } from '@/lib/auth/events';
import { cn } from '@/lib/ui/cn';

type AccountTab = 'profile' | 'addresses' | 'orders';
type AccountState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      profile: CustomerProfile;
      addresses: CustomerAddress[];
      orders: CustomerOrder[];
      orderCount: number;
    };

const TABS: ReadonlyArray<Readonly<{ id: AccountTab; label: string }>> = [
  { id: 'orders', label: 'سفارش‌ها' },
  { id: 'addresses', label: 'آدرس‌ها' },
  { id: 'profile', label: 'اطلاعات حساب' },
];

async function readJson<Value>(response: Response): Promise<Value> {
  if (!response.ok) throw new Error('دریافت اطلاعات حساب انجام نشد.');
  return (await response.json()) as Value;
}

export function AccountDashboard() {
  const [activeTab, setActiveTab] = useState<AccountTab>('orders');
  const [state, setState] = useState<AccountState>({ status: 'loading' });
  const tabRefs = useRef<Record<AccountTab, HTMLButtonElement | null>>({
    orders: null,
    addresses: null,
    profile: null,
  });

  useEffect(() => {
    let active = true;

    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          if (active) setState({ status: 'anonymous' });
          return;
        }

        const [profile, addresses, orderList] = await Promise.all([
          fetch('/api/profile', { cache: 'no-store' }).then(readJson<CustomerProfile>),
          fetch('/api/profile/addresses', { cache: 'no-store' }).then(readJson<CustomerAddress[]>),
          fetch('/api/orders', { cache: 'no-store' }).then(readJson<CustomerOrderList>),
        ]);

        if (active) {
          setState({
            status: 'ready',
            profile,
            addresses,
            orders: orderList.items,
            orderCount: orderList.total,
          });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error', message: 'دریافت اطلاعات حساب انجام نشد.' });
        }
      });

    const reloadAfterAuthentication = () => window.location.reload();
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, reloadAfterAuthentication);

    return () => {
      active = false;
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, reloadAfterAuthentication);
    };
  }, []);

  async function reloadAddresses() {
    const response = await fetch('/api/profile/addresses', { cache: 'no-store' });
    const addresses = await readJson<CustomerAddress[]>(response);
    setState((current) => (current.status === 'ready' ? { ...current, addresses } : current));
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  if (state.status === 'loading') {
    return (
      <div aria-label="در حال دریافت حساب" className="grid gap-6 pt-8 md:grid-cols-[15rem_1fr]">
        <Skeleton className="h-52" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (state.status === 'anonymous') {
    return (
      <EmptyState
        title="برای مشاهده حساب وارد شوید"
        description="پس از ورود، اطلاعات حساب، آدرس‌ها و سفارش‌های شما در دسترس است."
        action={<Button onClick={openAuthModal}>ورود یا ثبت‌نام</Button>}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        title="خطا در دریافت حساب"
        description={state.message}
        action={<Button onClick={() => window.location.reload()}>تلاش دوباره</Button>}
      />
    );
  }

  return (
    <div className="grid gap-8 pt-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12">
      <div
        role="tablist"
        aria-label="بخش‌های حساب کاربری"
        className="flex overflow-x-auto border-b border-[var(--sf-color-border)] md:block md:border-b-0 md:border-l"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`account-tab-${tab.id}`}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`account-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={cn(
              'inline-flex min-w-max items-center gap-2 border-b-2 px-5 py-4 text-base font-bold transition-colors sm:text-lg md:flex md:w-full md:border-b-0 md:border-l-2 md:text-right',
              activeTab === tab.id
                ? 'border-[var(--sf-color-ink)] text-[var(--sf-color-ink)]'
                : 'border-transparent text-[var(--sf-color-muted)] hover:text-[var(--sf-color-ink)]',
            )}
          >
            <span>{tab.label}</span>
            {tab.id === 'orders' ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--sf-color-surface-emphasis)] px-1.5 py-0.5 text-xs font-medium">
                {toPersianDigits(state.orderCount)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        id={`account-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`account-tab-${activeTab}`}
        tabIndex={0}
        className="min-w-0 outline-none"
      >
        {activeTab === 'profile' ? (
          <AccountProfilePanel
            profile={state.profile}
            onProfileChange={(profile) =>
              setState((current) =>
                current.status === 'ready' ? { ...current, profile } : current,
              )
            }
          />
        ) : null}
        {activeTab === 'addresses' ? (
          <AccountAddressesPanel
            addresses={state.addresses}
            profilePhone={state.profile.phone}
            reloadAddresses={reloadAddresses}
          />
        ) : null}
        {activeTab === 'orders' ? <AccountOrdersPanel orders={state.orders} /> : null}
      </div>
    </div>
  );
}
