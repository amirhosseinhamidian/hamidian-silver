import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WalletActionForm } from './wallet-action-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

it('sends a ledger correction with a positive toman amount, an audit reason and a request key', async () => {
  const id = '477fd285-1181-44c6-9d20-059a51ece6a1';
  const targetId = 'de30c630-6490-40d4-8fbb-452baee723b0';
  const requestId = '38d171b8-80de-4dd8-9627-b12dc1397624';
  const fetchMock = vi.fn(async (_path: string, _init: RequestInit) => ({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('crypto', { randomUUID: () => requestId });
  render(
    <WalletActionForm
      action={{ kind: 'corrections', id, targetId, correction: 'REVERSE_CAPTURE' }}
      label="برگشت اعتبار مصرف‌شده"
      fieldId="wallet-audit"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'برگشت اعتبار مصرف‌شده' }));
  const form = screen.getByRole('form', { name: 'برگشت اعتبار مصرف‌شده' });
  fireEvent.change(within(form).getByLabelText(/مبلغ اصلاح/), { target: { value: '۲۵۰۰' } });
  fireEvent.change(within(form).getByLabelText(/دلیل ثبت/), { target: { value: 'اصلاح پرداخت' } });
  fireEvent.submit(form);
  expect(await screen.findByText('اقدام ثبت شد.')).toBeInTheDocument();
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe(`/api/wallet/corrections/${id}`);
  expect(JSON.parse(String(init.body))).toEqual({
    amountToman: 2_500,
    reason: 'اصلاح پرداخت',
    requestId,
    targetId,
    kind: 'REVERSE_CAPTURE',
  });
});
