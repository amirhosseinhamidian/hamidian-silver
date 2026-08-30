export const ROLE_CODES = {
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const PERMISSION_CODES = {
  CATALOG_READ: 'catalog.read',
  CATALOG_WRITE: 'catalog.write',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_WRITE: 'inventory.write',
  ORDERS_READ: 'orders.read',
  ORDERS_STATUS_WRITE: 'orders.status.write',
  ORDERS_TRACKING_WRITE: 'orders.tracking.write',
  ORDERS_CANCEL: 'orders.cancel',
  CMS_READ: 'cms.read',
  CMS_WRITE: 'cms.write',
  PRICING_READ: 'pricing.read',
  PRICING_WRITE: 'pricing.write',
  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export type PermissionDefinition = {
  code: PermissionCode;
  name: string;
  description: string;
};

export type SystemRoleDefinition = {
  code: RoleCode;
  name: string;
  description: string;
};

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    code: PERMISSION_CODES.CATALOG_READ,
    name: 'Read catalog',
    description: 'View products, variants, categories, brands, and catalog metadata.',
  },
  {
    code: PERMISSION_CODES.CATALOG_WRITE,
    name: 'Manage catalog',
    description: 'Create and update products, variants, categories, brands, and catalog metadata.',
  },
  {
    code: PERMISSION_CODES.INVENTORY_READ,
    name: 'Read inventory',
    description: 'View warehouse inventory and stock movements.',
  },
  {
    code: PERMISSION_CODES.INVENTORY_WRITE,
    name: 'Manage inventory',
    description: 'Adjust stock and manage inventory operations.',
  },
  {
    code: PERMISSION_CODES.ORDERS_READ,
    name: 'Read orders',
    description: 'View orders and their operational details.',
  },
  {
    code: PERMISSION_CODES.ORDERS_STATUS_WRITE,
    name: 'Update order status',
    description: 'Update operational order statuses.',
  },
  {
    code: PERMISSION_CODES.ORDERS_TRACKING_WRITE,
    name: 'Update order tracking',
    description: 'Manage shipment tracking information for orders.',
  },
  {
    code: PERMISSION_CODES.ORDERS_CANCEL,
    name: 'Cancel orders',
    description: 'Run the privileged order cancellation workflow.',
  },
  {
    code: PERMISSION_CODES.CMS_READ,
    name: 'Read CMS',
    description: 'View managed pages, sections, banners, and announcement content.',
  },
  {
    code: PERMISSION_CODES.CMS_WRITE,
    name: 'Manage CMS',
    description: 'Create and update managed pages, sections, banners, and announcement content.',
  },
  {
    code: PERMISSION_CODES.PRICING_READ,
    name: 'Read pricing',
    description: 'View controlled product pricing information.',
  },
  {
    code: PERMISSION_CODES.PRICING_WRITE,
    name: 'Manage pricing',
    description: 'Change controlled product sale pricing.',
  },
  {
    code: PERMISSION_CODES.FINANCE_READ,
    name: 'Read finance',
    description: 'View financial ledgers, supplier payables, settlements, and related records.',
  },
  {
    code: PERMISSION_CODES.FINANCE_WRITE,
    name: 'Manage finance',
    description: 'Perform privileged financial and settlement operations.',
  },
  {
    code: PERMISSION_CODES.SETTINGS_READ,
    name: 'Read settings',
    description: 'View sensitive operational and business settings.',
  },
  {
    code: PERMISSION_CODES.SETTINGS_WRITE,
    name: 'Manage settings',
    description: 'Change sensitive operational and business settings.',
  },
  {
    code: PERMISSION_CODES.USERS_READ,
    name: 'Read users',
    description: 'View customer and staff account information.',
  },
  {
    code: PERMISSION_CODES.USERS_WRITE,
    name: 'Manage users',
    description: 'Manage privileged user and staff account operations.',
  },
  {
    code: PERMISSION_CODES.AUDIT_READ,
    name: 'Read audit log',
    description: 'View privileged audit history.',
  },
];

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    code: ROLE_CODES.MANAGER,
    name: 'Manager',
    description: 'Full privileged access to business and operational capabilities.',
  },
  {
    code: ROLE_CODES.ADMIN,
    name: 'Admin',
    description: 'Operational access without pricing, finance, or sensitive settings privileges.',
  },
  {
    code: ROLE_CODES.USER,
    name: 'User',
    description: 'Standard customer role without administrative privileges.',
  },
];

export const ADMIN_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_CODES.CATALOG_READ,
  PERMISSION_CODES.CATALOG_WRITE,
  PERMISSION_CODES.INVENTORY_READ,
  PERMISSION_CODES.INVENTORY_WRITE,
  PERMISSION_CODES.ORDERS_READ,
  PERMISSION_CODES.ORDERS_STATUS_WRITE,
  PERMISSION_CODES.ORDERS_TRACKING_WRITE,
  PERMISSION_CODES.CMS_READ,
  PERMISSION_CODES.CMS_WRITE,
];

export const SYSTEM_ROLE_PERMISSION_CODES: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  [ROLE_CODES.MANAGER]: Object.values(PERMISSION_CODES),
  [ROLE_CODES.ADMIN]: ADMIN_PERMISSION_CODES,
  [ROLE_CODES.USER]: [],
};
