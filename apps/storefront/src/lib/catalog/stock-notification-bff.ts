import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

export async function createStockNotification(request: Request): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return authenticationRequired();

  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for stock notification requests.');
  }

  const response = await fetch(new URL('/api/v1/stock-notifications', apiOrigin), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: await request.text(),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);

  return Response.json(payload, { status: response.status });
}
