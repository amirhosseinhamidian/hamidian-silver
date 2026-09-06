import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountAuthButton } from '@/components/auth/auth-modal';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function openAuthDialog() {
  render(<AccountAuthButton />);
  fireEvent.click(screen.getByRole('button', { name: 'ورود یا ثبت‌نام' }));
  return screen.getByRole('dialog');
}

async function requestCode(fetchMock: ReturnType<typeof vi.fn>, expiresAt?: string) {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      {
        challengeId: '10000000-0000-4000-8000-000000000001',
        expiresAt: expiresAt ?? new Date(Date.now() + 120_000).toISOString(),
      },
      202,
    ),
  );

  const dialog = openAuthDialog();
  fireEvent.change(within(dialog).getByLabelText('شماره تلفن همراه'), {
    target: { value: '۰۹۱۲۳۴۵۶۷۸۹' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'ارسال کد تأیید' }));

  await screen.findByRole('heading', { name: 'تأیید شماره همراه' });
  return dialog;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountAuthButton', () => {
  it('opens an accessible dialog and validates the Iranian mobile number', () => {
    const dialog = openAuthDialog();

    expect(within(dialog).getByRole('img', { name: 'لوگوی نقره حمیدیان' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'ورود یا ثبت‌نام' })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('شماره تلفن همراه'), {
      target: { value: '1234' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ارسال کد تأیید' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'شماره همراه را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.',
    );
  });

  it('normalizes localized digits and renders five keyboard-friendly OTP boxes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const dialog = await requestCode(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/otp/request',
      expect.objectContaining({
        body: JSON.stringify({ phone: '09123456789' }),
      }),
    );

    const otpInputs = Array.from({ length: 5 }, (_, index) =>
      within(dialog).getByLabelText(`رقم ${'۱۲۳۴۵'[index]} از ۵`),
    );

    expect(otpInputs).toHaveLength(5);
    expect(otpInputs[0]).toHaveAttribute('inputmode', 'numeric');
    expect(otpInputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(within(dialog).getByRole('button', { name: 'ویرایش شماره همراه' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'درخواست مجدد کد' })).toBeDisabled();
    expect(within(dialog).queryByText('اعتبار کد تأیید')).not.toBeInTheDocument();
    expect(otpInputs[0]).toHaveClass(
      'sf-auth-otp-input',
      'border-[var(--sf-color-border-strong)]',
      'focus:border-[var(--sf-color-ink)]',
    );

    fireEvent.paste(otpInputs[0], {
      clipboardData: { getData: () => '۱۲۳۴' },
    });

    expect(otpInputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      '۱',
      '۲',
      '۳',
      '۴',
      '',
    ]);

    fireEvent.keyDown(otpInputs[2], { key: 'ArrowLeft' });
    expect(otpInputs[1]).toHaveFocus();
    fireEvent.keyDown(otpInputs[1], { key: 'End' });
    expect(otpInputs[4]).toHaveFocus();
  });

  it('shows a red error state and shakes the OTP group after a rejected code', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const dialog = await requestCode(fetchMock);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired verification code.' },
        },
        401,
      ),
    );

    for (let index = 0; index < 5; index += 1) {
      fireEvent.change(within(dialog).getByLabelText(`رقم ${'۱۲۳۴۵'[index]} از ۵`), {
        target: { value: String(index + 1) },
      });
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید و ورود' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'کد واردشده اشتباه است یا اعتبار آن به پایان رسیده است.',
    );
    expect(within(dialog).getByTestId('otp-inputs')).toHaveClass('sf-auth-otp-error');
    expect(within(dialog).getByLabelText('رقم ۱ از ۵')).toHaveAttribute('aria-invalid', 'true');
  });

  it('animates to the success confirmation after a valid code', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const dialog = await requestCode(fetchMock);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        user: { id: '10000000-0000-4000-8000-000000000001', phone: '+989123456789' },
      }),
    );

    fireEvent.paste(within(dialog).getByLabelText('رقم ۱ از ۵'), {
      clipboardData: { getData: () => '12345' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید و ورود' }));

    await waitFor(() => {
      expect(within(dialog).getByRole('status')).toHaveTextContent('با موفقیت وارد شدید');
    });
    expect(within(dialog).getByRole('heading', { name: 'ورود موفق' })).toBeInTheDocument();
  });

  it('enables requesting a new code when the server expiry has passed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const dialog = await requestCode(fetchMock, new Date(Date.now() - 1_000).toISOString());

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'درخواست مجدد کد' })).toBeEnabled();
    });
    expect(within(dialog).getByRole('timer')).toHaveAttribute(
      'aria-label',
      'زمان باقی‌مانده ۰۰:۰۰',
    );
  });
});
