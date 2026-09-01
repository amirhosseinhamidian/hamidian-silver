export interface LoginRequest {
  phone: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
}
