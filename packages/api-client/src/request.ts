import { getApiClientConfig } from './config';
import { ApiClientError } from './errors';

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const { baseUrl } = getApiClientConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiClientError(await response.text(), response.status);
  }

  return response.json();
}
