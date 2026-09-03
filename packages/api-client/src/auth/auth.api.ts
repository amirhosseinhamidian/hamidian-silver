import type {
  RequestOtpRequest,
  VerifyOtpRequest,
  LoginResponse,
  CurrentUserResponse,
} from '@hamidian/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json();
}

export function requestOtp(data: RequestOtpRequest) {
  return request<void>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyOtp(data: VerifyOtpRequest) {
  return request<LoginResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getCurrentUser(token: string) {
  return request<CurrentUserResponse>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
