import type { AdminPermission, AdminRole } from '@/lib/auth/access-control';

export type ManagedPermission = Readonly<{
  code: AdminPermission;
  name: string;
  description: string | null;
}>;
export type ManagedRolePolicy = Readonly<{
  code: AdminRole;
  name: string;
  description: string | null;
  isEditable: boolean;
  assignedUserCount: number;
  permissionCodes: readonly AdminPermission[];
}>;
export type RoleManagementSnapshot = Readonly<{
  roles: readonly ManagedRolePolicy[];
  permissions: readonly ManagedPermission[];
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

function parsePermission(value: unknown): ManagedPermission | null {
  const source = record(value);
  const code = permissionCode(source?.code);
  const name = text(source?.name);
  const description = nullableText(source?.description);
  return source && code && name && description !== undefined ? { code, name, description } : null;
}
function parseRole(value: unknown): ManagedRolePolicy | null {
  const source = record(value);
  const code = roleCode(source?.code);
  const name = text(source?.name);
  const description = nullableText(source?.description);
  const permissionCodes = Array.isArray(source?.permissionCodes)
    ? source.permissionCodes.map(permissionCode)
    : null;
  if (
    !source ||
    !code ||
    !name ||
    description === undefined ||
    typeof source.isEditable !== 'boolean' ||
    typeof source.assignedUserCount !== 'number' ||
    !Number.isInteger(source.assignedUserCount) ||
    source.assignedUserCount < 0 ||
    !permissionCodes ||
    permissionCodes.some((item) => !item)
  )
    return null;
  return {
    code,
    name,
    description,
    isEditable: source.isEditable,
    assignedUserCount: source.assignedUserCount,
    permissionCodes: permissionCodes as AdminPermission[],
  };
}
export function parseRoleManagementSnapshot(value: unknown): RoleManagementSnapshot | null {
  const source = record(value);
  const roles = Array.isArray(source?.roles) ? source.roles.map(parseRole) : null;
  const permissions = Array.isArray(source?.permissions)
    ? source.permissions.map(parsePermission)
    : null;
  if (
    !source ||
    !roles ||
    roles.some((item) => !item) ||
    !permissions ||
    permissions.some((item) => !item)
  )
    return null;
  return { roles: roles as ManagedRolePolicy[], permissions: permissions as ManagedPermission[] };
}
