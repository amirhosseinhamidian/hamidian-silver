import type { AdminCurrentUser } from '@/lib/auth/access-control';

type CurrentUserLookupResult = Readonly<{
  data?: AdminCurrentUser;
  response: Pick<Response, 'ok' | 'status'>;
}>;

type CurrentUserLookup = (accessToken: string) => Promise<CurrentUserLookupResult>;

export class AdminSessionServiceError extends Error {
  constructor(readonly status: number | null) {
    super('Unable to verify the admin session.');
    this.name = 'AdminSessionServiceError';
  }
}

export async function verifyAdminAccessToken(
  accessToken: string,
  lookupCurrentUser: CurrentUserLookup,
): Promise<AdminCurrentUser | null> {
  try {
    const result = await lookupCurrentUser(accessToken);

    if (result.response.status === 401) return null;
    if (!result.response.ok) throw new AdminSessionServiceError(result.response.status);
    if (!result.data) throw new AdminSessionServiceError(502);

    return result.data;
  } catch (error) {
    if (error instanceof AdminSessionServiceError) throw error;
    throw new AdminSessionServiceError(null);
  }
}
