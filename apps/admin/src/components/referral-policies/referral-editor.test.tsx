import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReferralEditor, ReferralPublish } from './referral-editor';
import type { ReferralVersionDetail } from '@/lib/reward-policies/referral-reward-policy';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

const draft: ReferralVersionDetail = {
  version: 7,
  enabled: false,
  createdAt: '2026-11-24T10:00:00Z',
  createdById: 'author',
  requestedEffectiveAt: null,
  publishedAt: null,
  effectiveAt: null,
  publishedById: null,
  definition: { enabled: false, periodBudgetToman: 0, rules: [] },
};

it('previews independent recipient rules from the current form with read access', async () => {
  const fetchMock = vi.fn(async (_URL: string, _init: RequestInit) => ({
    ok: true,
    json: async () => ({
      totalToman: 2000,
      recipients: [
        {
          recipient: 'REFERRER',
          ruleCode: 'rule-1',
          amountToman: 2000,
          eligibleToman: 10000,
          reason: 'AWARDED',
          expiryDays: 60,
        },
        {
          recipient: 'REFERRED',
          ruleCode: 'rule-2',
          amountToman: 0,
          eligibleToman: 0,
          reason: 'NO_MATCH',
          expiryDays: null,
        },
      ],
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ReferralEditor selected={draft} canWrite={false} historyPage={1} />);
  fireEvent.click(screen.getByRole('button', { name: 'افزودن قانون معرف' }));
  fireEvent.click(screen.getByRole('button', { name: 'افزودن قانون معرفی‌شونده' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'پاداش معرفی فعال باشد' }));
  fireEvent.change(screen.getByLabelText(/بودجهٔ ماهانهٔ مجموع پاداش معرفی به تومان/), {
    target: { value: '۳۰۰۰' },
  });
  expect(screen.queryByRole('button', { name: 'ذخیرهٔ پیش‌نویس جدید' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'اجرای آزمایشی' }));
  expect(await screen.findByRole('status')).toHaveTextContent(/مجموع پاداش/);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/referral-reward-policies/simulation');
  expect(JSON.parse(String(init.body)).definition).toMatchObject({
    enabled: true,
    periodBudgetToman: 3000,
    rules: [
      { code: 'rule-1', recipient: 'REFERRER' },
      { code: 'rule-2', recipient: 'REFERRED' },
    ],
  });
});

it('requires confirmation before publishing the stored draft', async () => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: true,
    json: async () => draft,
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ReferralPublish draft={draft} />);
  const button = screen.getByRole('button', { name: 'انتشار نسخه' });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /انتشار همین پیش‌نویس/ }));
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(await screen.findByText('نسخه منتشر شد.')).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe('/api/referral-reward-policies/publish-7');
});
