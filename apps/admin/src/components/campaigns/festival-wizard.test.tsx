import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { festivalStepHref, suggestedFestivalSlug } from '@/lib/campaigns/festival-wizard';
import { CampaignEditor } from './campaign-editor';
import { CampaignLandingEditor } from './campaign-landing-editor';
import { CampaignPromotionEditor } from './campaign-promotion-editor';
import { FestivalDraftLink, FestivalWizardNavigation } from './festival-wizard-navigation';
import { MarketingCampaignEditor } from './marketing-campaign-editor';

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
    error,
  }: {
    label: string;
    name?: string;
    defaultValue?: string;
    required?: boolean;
    error?: string;
  }) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        data-calendar-field={name}
      />
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
  const saveButton = screen.getByRole('button', { name: 'ذخیره و انتخاب محصولات' });
  fireEvent.change(screen.getByLabelText('زمان پایان'), {
    target: { value: campaign.startsTehran },
  });
  fireEvent.click(saveButton);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('زمان پایان')).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(screen.getByLabelText('زمان پایان'), { target: { value: campaign.endsTehran } });
  fireEvent.click(saveButton);

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

it('marks the missing coupon limit and submits fractional percentages without rounding', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({}));
  vi.stubGlobal('fetch', save);
  render(<CampaignPromotionEditor id={id} rule={null} editable allowPercentageOverrides={false} />);
  fireEvent.change(screen.getByLabelText('درصد تخفیف', { exact: false }), {
    target: { value: '۱۲٫۵' },
  });
  fireEvent.change(screen.getByLabelText('سقف مبلغ هر سفارش (تومان)', { exact: false }), {
    target: { value: '۱۰۰۰۰' },
  });
  fireEvent.change(screen.getByLabelText('کد تخفیف'), { target: { value: 'sale12' } });
  const submit = screen.getByRole('button', { name: /ذخیره.*قانون/ });
  fireEvent.click(submit);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('سقف تعداد استفاده')).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(screen.getByLabelText('سقف تعداد استفاده'), { target: { value: '۲' } });
  fireEvent.click(submit);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(JSON.parse(String(save.mock.calls[0][1].body))).toMatchObject({
    value: 1250,
    maxDiscountBps: 2000,
    maxUses: 2,
    couponCode: 'SALE12',
  });
});

it('saves a standalone offer and opens its discount step with the list filters', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({ id }));
  vi.stubGlobal('fetch', save);
  render(<CampaignEditor createKind="SALES" listQuery={{ view: 'sales', status: 'DRAFT' }} />);

  expect(screen.queryByLabelText('کانال', { exact: false })).toBeNull();
  expect(screen.queryByText('تنظیمات نمایش کمپین')).toBeNull();
  fireEvent.change(screen.getByLabelText('نام پیشنهاد', { exact: false }), {
    target: { value: 'پیشنهاد نقره' },
  });
  fireEvent.change(screen.getByLabelText('هدف', { exact: false }), {
    target: { value: campaign.goal },
  });
  fireEvent.change(screen.getByLabelText('زمان آغاز'), {
    target: { value: campaign.startsTehran },
  });
  fireEvent.change(screen.getByLabelText('زمان پایان'), { target: { value: campaign.endsTehran } });
  fireEvent.change(screen.getByLabelText('سقف بودجهٔ تخفیف (تومان)', { exact: false }), {
    target: { value: '۵۰۰۰۰' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(
      `/campaigns?view=sales&status=DRAFT&id=${id}&step=promotion`,
    ),
  );
  const [path, request] = save.mock.calls[0];
  expect(path).toBe('/api/campaigns');
  const body = JSON.parse(String(request.body));
  expect(body).toMatchObject({
    managementPurpose: 'SALES',
    bannerEnabled: false,
    bannerPriority: 0,
    budgetToman: 50_000,
  });
  expect(body).not.toHaveProperty('trackingId');
  expect(body).not.toHaveProperty('kind');
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

it('creates a marketing draft with a destination and a separate advertising budget', async () => {
  const save = vi.fn(async (_path: string, _request: RequestInit) => Response.json({ id }));
  vi.stubGlobal('fetch', save);
  const listPath = '/campaigns?view=marketing';
  render(<MarketingCampaignEditor listPath={listPath} />);

  fireEvent.change(screen.getByLabelText('نام کمپین', { exact: false }), {
    target: { value: 'تبلیغ نقره' },
  });
  fireEvent.change(screen.getByLabelText('هدف تجاری', { exact: false }), {
    target: { value: 'معرفی فروشگاه' },
  });
  fireEvent.change(screen.getByLabelText('توضیحات', { exact: false }), {
    target: { value: 'معرفی محصولات تازه' },
  });
  fireEvent.change(screen.getByLabelText('زمان آغاز'), {
    target: { value: campaign.startsTehran },
  });
  fireEvent.change(screen.getByLabelText('زمان پایان'), { target: { value: campaign.endsTehran } });
  fireEvent.change(
    screen.getByLabelText('بودجهٔ برنامه‌ریزی‌شدهٔ تبلیغات (تومان)', { exact: false }),
    { target: { value: '۲۰۰۰۰' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ پیش‌نویس' }));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(`${listPath}&id=${id}&step=review`),
  );
  const [path, request] = save.mock.calls[0];
  expect(path).toBe('/api/campaigns');
  expect(JSON.parse(String(request.body))).toMatchObject({
    kind: 'MARKETING',
    channel: 'instagram',
    budgetToman: 20_000,
    bannerEnabled: false,
    marketing: {
      destinationPath: '/products',
      relatedFestivalId: null,
      relatedSalesCampaignId: null,
    },
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
