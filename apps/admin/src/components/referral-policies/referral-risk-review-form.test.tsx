import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReferralRiskReviewForm } from './referral-risk-review-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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
  fireEvent.change(screen.getByLabelText(/تصمیم بررسی/), { target: { value: 'ALLOW' } });
  fireEvent.change(screen.getByLabelText(/دلیل تصمیم/), { target: { value: 'پرداخت بررسی شد' } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت تصمیم' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/وضعیت موجود/);
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe(`/api/referral-risk/review-${caseId}`);
  expect(JSON.parse(String(init.body))).toEqual({
    expectedRevision: 2,
    action: 'ALLOW',
    reason: 'پرداخت بررسی شد',
  });
});
