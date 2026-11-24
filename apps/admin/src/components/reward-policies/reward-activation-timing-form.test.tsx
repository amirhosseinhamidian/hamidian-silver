import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardActivationTimingForm } from './reward-activation-timing-form';

describe('RewardActivationTimingForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['۱۲', 12],
    ['immediate', 0],
  ] as const)('saves %s as %i days', async (entry, activationDelayDays) => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({ policyVersion: 4, activationDelayDays, expiryDays: 180 }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => '10000000-0000-4000-8000-000000000001' });
    render(
      <RewardActivationTimingForm
        initialTiming={{ policyVersion: 3, activationDelayDays: 7, expiryDays: 270 }}
        canWrite
      />,
    );

    const daysField = screen.getByRole('textbox', { name: /تعداد روز پس از تحویل/ });
    if (entry === 'immediate') {
      fireEvent.click(screen.getByRole('radio', { name: 'بلافاصله پس از تحویل' }));
      expect(daysField).not.toBeInTheDocument();
    } else {
      fireEvent.change(daysField, { target: { value: entry } });
    }
    fireEvent.change(screen.getByRole('textbox', { name: /مهلت مصرف از صدور اعتبار/ }), {
      target: { value: '۱۸۰' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و انتشار' }));

    expect(await screen.findByText('زمان‌بندی پاداش ذخیره شد.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reward-policies/activation-timing');
    expect(JSON.parse(String(init.body))).toMatchObject({
      expectedPolicyVersion: 3,
      activationDelayDays,
      expiryDays: 180,
    });
  });
});
