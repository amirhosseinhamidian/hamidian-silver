import type { AdminPermission, AdminRole } from '@/lib/auth/access-control';

export type ManagedRole = Readonly<{
  code: AdminRole;
  name: string;
  description: string | null;
  permissions: readonly Readonly<{
    code: AdminPermission;
    name: string;
    description: string | null;
  }>[];
}>;

export type ManagedUserRole = Readonly<{
  code: AdminRole;
  name: string;
  assignedAt: string;
  permissions: readonly AdminPermission[];
}>;

export type ManagedUser = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  roles: readonly ManagedUserRole[];
  effectivePermissions: readonly AdminPermission[];
}>;

export type UserManagementSnapshot = Readonly<{
  users: readonly ManagedUser[];
  roles: readonly ManagedRole[];
}>;

type UnknownRecord = Record<string, unknown>;

const ROLE_CODES = new Set<AdminRole>(['MANAGER', 'ADMIN', 'USER']);
const PERMISSION_CODES = new Set<AdminPermission>([
  'catalog.read',
  'catalog.write',
  'inventory.read',
  'inventory.write',
  'orders.read',
  'orders.status.write',
  'orders.tracking.write',
  'orders.cancel',
  'cms.read',
  'cms.write',
  'pricing.read',
  'pricing.write',
  'finance.read',
  'finance.write',
  'settings.read',
  'settings.write',
  'users.read',
  'users.write',
  'audit.read',
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableDate(value: unknown): string | null | undefined {
  return value === null ? null : (date(value) ?? undefined);
}

function roleCode(value: unknown): AdminRole | null {
  return typeof value === 'string' && ROLE_CODES.has(value as AdminRole)
    ? (value as AdminRole)
    : null;
}

function permissionCode(value: unknown): AdminPermission | null {
  return typeof value === 'string' && PERMISSION_CODES.has(value as AdminPermission)
    ? (value as AdminPermission)
    : null;
}

function permission(value: unknown): ManagedRole['permissions'][number] | null {
  const source = record(value);
  const code = permissionCode(source?.code);
  const name = text(source?.name);
  const description = nullableText(source?.description);
  return source && code && name && description !== undefined ? { code, name, description } : null;
}

function catalogRole(value: unknown): ManagedRole | null {
  const source = record(value);
  const code = roleCode(source?.code);
  const name = text(source?.name);
  const description = nullableText(source?.description);
  const permissions = Array.isArray(source?.permissions)
    ? source.permissions.map(permission)
    : null;
  if (
    !source ||
    !code ||
    !name ||
    description === undefined ||
    !permissions ||
    permissions.some((item) => !item)
  )
    return null;
  return { code, name, description, permissions: permissions as ManagedRole['permissions'] };
}

function userRole(value: unknown): ManagedUserRole | null {
  const source = record(value);
  const code = roleCode(source?.code);
  const name = text(source?.name);
  const assignedAt = date(source?.assignedAt);
  const permissions = Array.isArray(source?.permissions)
    ? source.permissions.map(permissionCode)
    : null;
  if (!source || !code || !name || !assignedAt || !permissions || permissions.some((item) => !item))
    return null;
  return { code, name, assignedAt, permissions: permissions as AdminPermission[] };
}

export function parseManagedUser(value: unknown): ManagedUser | null {
  const source = record(value);
  const id = text(source?.id);
  const phone = text(source?.phone);
  const firstName = nullableText(source?.firstName);
  const lastName = nullableText(source?.lastName);
  const phoneVerifiedAt = nullableDate(source?.phoneVerifiedAt);
  const lastLoginAt = nullableDate(source?.lastLoginAt);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const roles = Array.isArray(source?.roles) ? source.roles.map(userRole) : null;
  const effectivePermissions = Array.isArray(source?.effectivePermissions)
    ? source.effectivePermissions.map(permissionCode)
    : null;
  if (
    !source ||
    !id ||
    !phone ||
    firstName === undefined ||
    lastName === undefined ||
    phoneVerifiedAt === undefined ||
    lastLoginAt === undefined ||
    !createdAt ||
    !updatedAt ||
    typeof source.isActive !== 'boolean' ||
    typeof source.activeSessionCount !== 'number' ||
    !Number.isInteger(source.activeSessionCount) ||
    source.activeSessionCount < 0 ||
    !roles ||
    roles.some((item) => !item) ||
    !effectivePermissions ||
    effectivePermissions.some((item) => !item)
  )
    return null;
  return {
    id,
    phone,
    firstName,
    lastName,
    isActive: source.isActive,
    phoneVerifiedAt,
    lastLoginAt,
    createdAt,
    updatedAt,
    activeSessionCount: source.activeSessionCount,
    roles: roles as ManagedUserRole[],
    effectivePermissions: effectivePermissions as AdminPermission[],
  };
}

export function parseUserManagementSnapshot(value: unknown): UserManagementSnapshot | null {
  const source = record(value);
  const users = Array.isArray(source?.users) ? source.users.map(parseManagedUser) : null;
  const roles = Array.isArray(source?.roles) ? source.roles.map(catalogRole) : null;
  if (!source || !users || users.some((item) => !item) || !roles || roles.some((item) => !item))
    return null;
  return { users: users as ManagedUser[], roles: roles as ManagedRole[] };
}
