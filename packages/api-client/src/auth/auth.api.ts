import type { LoginRequest, LoginResponse } from '@hamidian/types';

import { apiClient } from '../client';

export function login(payload: LoginRequest) {
  return apiClient.post<LoginResponse>('/auth/login', payload);
}
