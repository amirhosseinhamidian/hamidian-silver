import type { Role } from '../role/role';

export interface User {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  phoneVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;

  roles?: Role[];
}
