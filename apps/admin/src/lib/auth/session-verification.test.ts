import { describe, expect, it, vi } from 'vitest';

import { AdminSessionServiceError, verifyAdminAccessToken } from '@/lib/auth/session-verification';

const adminUser = {
  id: 'admin-1',
  phone: '09121234567',
  roles: ['ADMIN'] as const,
  permissions: ['orders.read'] as const,
};

function apiResult(status: number, data?: typeof adminUser) {
  return {
    data,
    response: { status, ok: status >= 200 && status < 300 },
  };
}

describe('admin session verification', () => {
  it('returns the current user from a valid backend session', async () => {
    const lookup = vi.fn().mockResolvedValue(apiResult(200, adminUser));

    await expect(verifyAdminAccessToken('opaque-session', lookup)).resolves.toEqual(adminUser);
    expect(lookup).toHaveBeenCalledWith('opaque-session');
  });

  it('treats a 401 response as an expired session', async () => {
    const lookup = vi.fn().mockResolvedValue(apiResult(401));

    await expect(verifyAdminAccessToken('expired-session', lookup)).resolves.toBeNull();
  });

  it.each([
    { result: apiResult(503), status: 503 },
    { result: apiResult(200), status: 502 },
  ])('fails closed for an invalid upstream response', async ({ result, status }) => {
    const lookup = vi.fn().mockResolvedValue(result);
    const error = await verifyAdminAccessToken('opaque-session', lookup).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AdminSessionServiceError);
    expect(error).toMatchObject({ status });
  });

  it('normalizes network failures without exposing their internals', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const error = await verifyAdminAccessToken('opaque-session', lookup).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AdminSessionServiceError);
    expect(error).toMatchObject({ status: null, message: 'Unable to verify the admin session.' });
  });
});
