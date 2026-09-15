import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

type RouteContext = Readonly<{ params: Promise<{ attemptId: string }> }>;

async function token(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const accessToken = await token();
  if (!accessToken) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const { attemptId } = await params;

  try {
    const response = await requestAdminCatalog(
      `/api/v1/payments/attempts/${encodeURIComponent(attemptId)}/receipt`,
      accessToken,
      { headers: { Accept: 'image/*' } },
    );

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': response.headers.get('content-disposition') ?? 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ message: 'Receipt service is unavailable.' }, { status: 502 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const accessToken = await token();
  if (!accessToken) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const { attemptId } = await params;

  try {
    const response = await requestAdminCatalog(
      `/api/v1/payments/attempts/${encodeURIComponent(attemptId)}/receipt/confirm`,
      accessToken,
      { method: 'POST' },
    );

    return Response.json((await readJsonResponse(response)) ?? null, {
      status: response.status,
    });
  } catch {
    return Response.json({ message: 'Receipt service is unavailable.' }, { status: 502 });
  }
}
