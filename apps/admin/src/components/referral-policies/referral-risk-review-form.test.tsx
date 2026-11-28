import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReferralRiskReviewForm } from './referral-risk-review-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Exercise the form value and required constraint independently of the shared popup.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    id,
    name,
    defaultValue,
    required,
    options,
  }: ComponentProps<typeof import('@/components/ui/select').Select>) => (
    <select id={id} name={name} defaultValue={defaultValue} required={required}>
      {options.map(({ value, label, disabled }) => (
        <option key={value} value={value} disabled={disabled}>
          {label}
        </option>
      ))}
    </select>
  ),
}));
afterEach(() => vi.unstubAllGlobals());

it('sends only the expected revision and the justified decision, and reports a stale case', async () => {
  const caseId = '477fd285-1181-44c6-9d20-059a51ece6a1';
  const fetchMock = vi.fn(async (_path: string, _init: RequestInit) => ({
    ok: false,
    status: 409,
    json: async () => null,
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ReferralRiskReviewForm caseId={caseId} revision={2} />);
  const decision = screen.getByRole('combobox', { name: /تصمیم بررسی/ });
  const form = decision.closest('form')!;
  fireEvent.change(screen.getByLabelText(/دلیل تصمیم/), { target: { value: 'پرداخت بررسی شد' } });
  expect(decision).toBeRequired();
  expect(form.checkValidity()).toBe(false);

  fireEvent.change(decision, { target: { value: 'ALLOW' } });
  expect(new FormData(form).get('action')).toBe('ALLOW');
  expect(form.checkValidity()).toBe(true);

  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'ثبت تصمیم' }));
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(within(form).getByRole('alert')).toHaveTextContent(/وضعیت موجود/);
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe(`/api/referral-risk/review-${caseId}`);
  expect(JSON.parse(String(init.body))).toEqual({
    expectedRevision: 2,
    action: 'ALLOW',
    reason: 'پرداخت بررسی شد',
  });
});
