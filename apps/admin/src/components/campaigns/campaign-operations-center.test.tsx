import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CampaignOperationsCenter } from './campaign-operations-center';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

type Props = ComponentProps<typeof CampaignOperationsCenter>;

const campaign: Props['campaign'] = {
  id: 'festival-id',
  revision: 4,
  kind: 'FESTIVAL',
  status: 'ACTIVE',
  name: 'جشنوارهٔ تست',
  trackingId: 'festival-test',
  archivedAt: null,
  startsAt: '2026-11-26T08:00:00.000Z',
  endsAt: '2026-11-26T18:00:00.000Z',
  budget: {
    discountBudgetToman: 10_000,
    committedDiscountToman: 3_000,
    remainingDiscountToman: 7_000,
    usedOrders: 1,
    remainingUses: null,
    blockers: [],
    warnings: [],
  },
  history: [],
};

const festival = {
  version: 4,
  navigation: true,
  announcement: false,
  publicationError: null,
  stockShortfallProducts: 1,
  missingDefaultPriceProducts: 0,
} satisfies NonNullable<Props['data']['festival']>;

const data: Props['data'] = {
  publication: 'LIVE',
  festival,
  landingSlug: 'festival-test',
  checkedAt: '2026-11-26T10:00:00.000Z',
  orders: {
    registered: 26,
    confirmed: 0,
    awaitingReceipt: 0,
    rejectedReceipt: 0,
    pending: 26,
    paymentFailed: 0,
    reconciliation: 0,
    cancelled: 0,
    expired: 0,
    overdueReservations: 0,
  },
  orderPage: 1,
  orderItems: [],
  hasMoreOrders: true,
  quota: { products: 26, limit: 26, reserved: 0, manualSold: 0, siteSold: 0, remaining: 26 },
  quotaPage: 1,
  quotaItems: [],
  hasMoreQuotas: true,
  finance: { confirmedMerchandiseDiscountToman: 0, confirmedShippingDiscountToman: 0 },
};

describe('festival operations', () => {
  it('keeps order state and sort in pagination and shows the festival-wide shortfall', () => {
    render(
      <CampaignOperationsCenter
        campaign={campaign}
        data={data}
        orderState="PENDING"
        orderSort="oldest"
        canWrite
        canReadAudit
        canEditCatalog
      />,
    );
    expect(screen.getByRole('link', { name: 'مشاهدهٔ صفحه در فروشگاه' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/campaigns\/festival-test$/),
    );
    expect(screen.getByText('محصولات با کسری موجودی نسبت به سهمیه ۱')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3000');
    expect(screen.getByRole('button', { name: 'توقف اضطراری' })).toBeVisible();
    const pager = screen.getByRole('navigation', { name: 'صفحات سفارش‌های کمپین' });
    expect(within(pager).getByRole('link', { name: 'صفحهٔ بعد' }).getAttribute('href')).toBe(
      '/campaigns?id=festival-id&step=operations&orderPage=2&orderState=PENDING&orderSort=oldest',
    );
  });

  it('shows the publication blocker and limits actions for the read-only role', () => {
    render(
      <CampaignOperationsCenter
        campaign={{ ...campaign, status: 'PAUSED' }}
        data={{
          ...data,
          publication: 'INACTIVE',
          festival: {
            ...festival,
            navigation: false,
            publicationError: 'The collection has no sellable products.',
          },
          finance: null,
        }}
        orderSort="newest"
        canWrite={false}
        canReadAudit={false}
        canEditCatalog={false}
      />,
    );
    expect(screen.getByText('نیاز به بررسی انتشار')).toBeVisible();
    expect(screen.getByRole('link', { name: 'باز کردن تنظیمات لندینگ' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'مشاهدهٔ صفحه در فروشگاه' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'مدیریت سهمیه و فروش دستی' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'گزارش عملیات مدیران' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'توقف اضطراری' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
