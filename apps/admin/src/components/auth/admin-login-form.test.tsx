import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminLoginForm } from '@/components/auth/admin-login-form';

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function otpRequestResponse(expiresAt = new Date(Date.now() + 120_000).toISOString()) {
  return jsonResponse({ challengeId: 'challenge-1', expiresAt }, 202);
}

async function requestOtp(fetchMock: ReturnType<typeof vi.fn>, phone = '۰۹۱۲۳۴۵۶۷۸۹') {
  fetchMock.mockResolvedValueOnce(otpRequestResponse());
  render(<AdminLoginForm nextPath="/orders?status=pending" />);

  fireEvent.change(screen.getByLabelText(/شماره تلفن همراه/), {
    target: { value: phone },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ارسال کد تأیید' }));

  await screen.findByRole('heading', { name: 'تأیید شماره همراه' });
}

describe('AdminLoginForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    routerMocks.replace.mockReset();
    routerMocks.refresh.mockReset();
  });

  it('validates the mobile number before requesting an OTP', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminLoginForm nextPath="/" />);
    fireEvent.change(screen.getByLabelText(/شماره تلفن همراه/), {
      target: { value: '۰۹۱۲' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد تأیید' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'شماره همراه را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the phone and renders five localized keyboard-friendly OTP inputs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await requestOtp(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/otp/request',
      expect.objectContaining({ body: JSON.stringify({ phone: '09123456789' }) }),
    );
    expect(screen.getByText('کد ارسال‌شده به ۰۹۱۲۳۴۵۶۷۸۹ را وارد کنید.')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAccessibleName(/۰۲:۰۰/);

    const inputs = screen.getAllByLabelText(/رقم [۰-۹] از ۵/);
    expect(inputs).toHaveLength(5);

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '۱۲۳۴' },
    });

    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      '۱',
      '۲',
      '۳',
      '۴',
      '',
    ]);
    expect(inputs[4]).toHaveFocus();

    fireEvent.keyDown(inputs[4], { key: 'ArrowLeft' });
    expect(inputs[3]).toHaveFocus();
    fireEvent.keyDown(inputs[3], { key: 'Home' });
    expect(inputs[0]).toHaveFocus();
  });

  it('automatically verifies a complete OTP and redirects after the success animation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await requestOtp(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ user: { id: 'admin-1', roles: ['ADMIN'], permissions: [] } }),
    );

    fireEvent.paste(screen.getAllByLabelText(/رقم [۰-۹] از ۵/)[0], {
      clipboardData: { getData: () => '۱۲۳۴۵' },
    });

    expect(await screen.findByRole('status')).toHaveTextContent('ورود با موفقیت انجام شد');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/otp/verify',
      expect.objectContaining({
        body: JSON.stringify({ phone: '09123456789', code: '12345' }),
      }),
    );

    await waitFor(
      () => {
        expect(routerMocks.replace).toHaveBeenCalledWith('/orders?status=pending');
        expect(routerMocks.refresh).toHaveBeenCalledOnce();
      },
      { timeout: 1_500 },
    );
  });

  it('shows an access error and marks every OTP input as invalid', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await requestOtp(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403),
    );

    fireEvent.paste(screen.getAllByLabelText(/رقم [۰-۹] از ۵/)[0], {
      clipboardData: { getData: () => '۱۲۳۴۵' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'این حساب اجازه ورود به پنل مدیریت را ندارد.',
    );
    expect(screen.getByTestId('admin-otp-inputs')).toHaveClass('admin-auth-otp-error');
    screen
      .getAllByLabelText(/رقم [۰-۹] از ۵/)
      .forEach((input) => expect(input).toHaveAttribute('aria-invalid', 'true'));
  });

  it('enables resend after the server-provided expiry time', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(otpRequestResponse(new Date(Date.now() - 1_000).toISOString()))
      .mockResolvedValueOnce(otpRequestResponse());
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminLoginForm nextPath="/" />);
    fireEvent.change(screen.getByLabelText(/شماره تلفن همراه/), {
      target: { value: '09123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال کد تأیید' }));

    const resend = await screen.findByRole('button', { name: 'ارسال مجدد کد' });
    await waitFor(() => expect(resend).toBeEnabled());
    fireEvent.click(resend);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/otp/request',
      expect.objectContaining({ body: JSON.stringify({ phone: '09123456789' }) }),
    );
  });
});
