import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { festivalStepHref, suggestedFestivalSlug } from '@/lib/campaigns/festival-wizard';
import { CampaignEditor } from './campaign-editor';
import { CampaignLandingEditor } from './campaign-landing-editor';
import { FestivalDraftLink, FestivalWizardNavigation } from './festival-wizard-navigation';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/campaigns/campaign-selection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/campaigns/campaign-selection')>()),
  useCampaignTaxonomy: () => ({ data: { categories: [], brands: [] } }),
}));
vi.mock('@/components/ui/dual-calendar-picker', () => ({
  DualCalendarPicker: ({
    label,
    name,
    defaultValue,
    required,
  }: {
    label: string;
    name?: string;
    defaultValue?: string;
    required?: boolean;
  }) => (
    <label>
      {label}
      <input name={name} defaultValue={defaultValue} required={required} />
    </label>
  ),
}));

const id = '4138cb94-849a-482f-8724-a58b890a9a4f';
const campaign: CampaignDetail = {
  id,
  ownerId: 'account',
  revision: 7,
  kind: 'FESTIVAL',
  status: 'DRAFT',
  name: 'جشنوارهٔ جمعه',
  slug: 'black-friday',
  archivedAt: null,
  startsAt: '2026-11-26T08:00:00.000Z',
  endsAt: '2026-11-27T08:00:00.000Z',
  startsTehran: '1405/09/05 11:30',
  endsTehran: '1405/09/06 11:30',
  productSlugs: ['silver-ring'],
  categorySlugs: ['silver'],
  plannedChannelCostToman: null,
  audience: 'ALL_CUSTOMERS',
  budget: {
    discountBudgetToman: 500_000,
    committedDiscountToman: 0,
    remainingDiscountToman: 500_000,
    usedOrders: 0,
    remainingUses: null,
    blockers: [],
    warnings: [],
  },
  goal: 'فروش نقره',
  ctaPath: '/products',
  ctaLabel: 'خرید',
  media: { id: 'media', altText: 'نقره', url: null, mimeType: 'image/png' },
  history: [],
  channel: 'festival',
  trackingId: 'festival-test',
  trackingLabel: 'festival-test',
  allProducts: false,
  budgetToman: 500_000,
  message: 'نقرهٔ جشنواره',
  bannerEnabled: true,
  bannerPriority: 20,
  historyPage: 1,
  hasMoreHistory: false,
};

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('starts with the basic fields and opens product selection after an automatically named draft is saved', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({ id }));
  vi.stubGlobal('fetch', save);
  render(<CampaignEditor view="basics" />);
  expect(screen.queryByText('محدودهٔ محصول')).toBeNull();
  expect(screen.queryByLabelText('سقف کل بودجه (تومان)')).toBeNull();
  fireEvent.change(screen.getByLabelText('نام جشنواره', { exact: false }), {
    target: { value: campaign.name },
  });
  fireEvent.change(screen.getByLabelText('هدف', { exact: false }), {
    target: { value: campaign.goal },
  });
  fireEvent.change(screen.getByLabelText('زمان آغاز'), {
    target: { value: campaign.startsTehran },
  });
  fireEvent.change(screen.getByLabelText('زمان پایان'), { target: { value: campaign.endsTehran } });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیره و انتخاب محصولات' }));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(festivalStepHref(id, 'products')),
  );
  expect(JSON.parse(String(save.mock.calls[0][1].body))).toMatchObject({
    kind: 'FESTIVAL',
    slug: expect.stringMatching(/^festival-[a-f0-9]{8}$/),
    message: campaign.name,
    allProducts: true,
    budgetToman: 0,
  });
  expect(suggestedFestivalSlug('Black Friday 2026', 'abcd1234')).toBe('black-friday-2026-abcd1234');
});

it('keeps the saved scope, schedule and placement settings when the budget step is saved', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({ id }));
  vi.stubGlobal('fetch', save);
  render(<CampaignEditor campaign={campaign} view="promotion" />);
  fireEvent.change(screen.getByLabelText('سقف کل بودجه (تومان)', { exact: false }), {
    target: { value: '۸۰۰۰۰۰' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  const [path, request] = save.mock.calls[0];
  expect(path).toBe(`/api/campaigns/${id}`);
  expect(JSON.parse(String(request.body))).toMatchObject({
    expectedRevision: 7,
    budgetToman: 800_000,
    startsTehran: campaign.startsTehran,
    endsTehran: campaign.endsTehran,
    productSlugs: campaign.productSlugs,
    categorySlugs: campaign.categorySlugs,
    bannerEnabled: true,
    bannerPriority: 20,
    message: campaign.message,
    ctaPath: campaign.ctaPath,
    ctaLabel: campaign.ctaLabel,
    mediaId: campaign.media?.id,
  });
});

it('keeps the saved collection and announcement when editing only landing details', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({}));
  vi.stubGlobal('fetch', save);
  const landing = {
    slug: 'black-friday',
    seoMode: 'RECURRING',
    title: 'عنوان اولیه',
    story: 'شرح جشنواره',
    collectionMode: 'FILTERED',
    filters: { minimumQuantity: 3, brands: ['sample-brand'], sort: 'price-desc' },
    manualProductSlugs: [],
    placements: [
      { slot: 'COUNTDOWN', priority: 20, appearance: { display: { message: 'اعلان' } } },
    ],
  } as const;
  render(
    <CampaignLandingEditor
      campaign={campaign}
      editor={{
        revision: 7,
        landing: {
          ...landing,
          filters: { ...landing.filters, brands: [...landing.filters.brands] },
          manualProductSlugs: [],
          placements: [...landing.placements],
        },
      }}
      canWrite
      view="details"
    />,
  );
  fireEvent.change(screen.getByLabelText('عنوان صفحه', { exact: false }), {
    target: { value: 'عنوان ویرایش‌شده' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ لندینگ' }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(JSON.parse(String(save.mock.calls[0][1].body))).toEqual({
    ...landing,
    expectedRevision: 7,
    title: 'عنوان ویرایش‌شده',
  });
});

it('marks the selected step and resumes the draft from the list in the same browser', () => {
  render(
    <>
      <FestivalWizardNavigation
        id={id}
        accountId="account"
        name={campaign.name}
        step="theme"
        remember
      />
      <FestivalDraftLink id={id} accountId="account" name="ادامهٔ جشنواره" />
    </>,
  );
  const nav = within(screen.getByRole('navigation', { name: 'مراحل جشنواره' }));
  expect(nav.getAllByRole('link')).toHaveLength(8);
  expect(nav.getByRole('link', { name: /تم جشنواره/ })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('link', { name: 'ادامهٔ جشنواره' }));
  expect(router.push).toHaveBeenCalledWith(festivalStepHref(id, 'theme'));
});
