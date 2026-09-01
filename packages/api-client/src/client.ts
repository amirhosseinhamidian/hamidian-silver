import { apiRequest } from './request';

export const apiClient = {
  get<T>(path: string) {
    return apiRequest<T>(path, {
      method: 'GET',
    });
  },

  post<T>(path: string, body: unknown) {
    return apiRequest<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put<T>(path: string, body: unknown) {
    return apiRequest<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string) {
    return apiRequest<T>(path, {
      method: 'DELETE',
    });
  },
};
