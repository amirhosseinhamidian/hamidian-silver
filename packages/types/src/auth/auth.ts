export interface RequestOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

export interface AuthUser {
  id: string;
  phone: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  id: string;
  phone: string;
  roles: string[];
  permissions: string[];
}
