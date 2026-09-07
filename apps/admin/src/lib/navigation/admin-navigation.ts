import {
  hasAllAdminPermissions,
  type AdminCurrentUser,
  type AdminPermission,
} from '@/lib/auth/access-control';

export type AdminNavigationIcon =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'plating'
  | 'fulfillment'
  | 'alerts'
  | 'finance'
  | 'suppliers'
  | 'content'
  | 'users'
  | 'settings'
  | 'audit';

export type AdminNavigationItem = Readonly<{
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  icon: AdminNavigationIcon;
  description: string;
  roadmapStage: number;
}>;

export type AdminNavigationGroup = Readonly<{
  id: string;
  label: string;
  items: readonly AdminNavigationItem[];
}>;

type AdminNavigationDefinition = AdminNavigationItem &
  Readonly<{
    permissions: readonly AdminPermission[];
  }>;

type AdminNavigationGroupDefinition = Readonly<{
  id: string;
  label: string;
  items: readonly AdminNavigationDefinition[];
}>;

const NAVIGATION_DEFINITIONS: readonly AdminNavigationGroupDefinition[] = [
  {
    id: 'overview',
    label: 'نمای کلی',
    items: [
      {
        id: 'dashboard',
        label: 'داشبورد عملیات',
        shortLabel: 'داشبورد',
        href: '/',
        icon: 'dashboard',
        description: 'شاخص‌ها، هشدارها و صف‌های مهم',
        roadmapStage: 4,
        permissions: [],
      },
      {
        id: 'alerts',
        label: 'هشدارهای عملیاتی',
        shortLabel: 'هشدارها',
        href: '/alerts',
        icon: 'alerts',
        description: 'موارد حساس، escalation و پیگیری',
        roadmapStage: 25,
        permissions: ['orders.read'],
      },
    ],
  },
  {
    id: 'commerce',
    label: 'فروش و کالا',
    items: [
      {
        id: 'orders',
        label: 'سفارش‌ها',
        shortLabel: 'سفارش‌ها',
        href: '/orders',
        icon: 'orders',
        description: 'بررسی و عملیات سفارش',
        roadmapStage: 15,
        permissions: ['orders.read'],
      },
      {
        id: 'products',
        label: 'محصولات',
        shortLabel: 'محصولات',
        href: '/products',
        icon: 'products',
        description: 'کاتالوگ، تصاویر و تنوع‌ها',
        roadmapStage: 5,
        permissions: ['catalog.read'],
      },
      {
        id: 'categories',
        label: 'دسته‌بندی‌ها',
        shortLabel: 'دسته‌ها',
        href: '/categories',
        icon: 'products',
        description: 'ساختار، ترتیب و تصاویر دسته‌بندی‌ها',
        roadmapStage: 8,
        permissions: ['catalog.read'],
      },
      {
        id: 'brands',
        label: 'برندها و کشورها',
        shortLabel: 'برندها',
        href: '/brands',
        icon: 'products',
        description: 'برند، کشور سازنده، تصویر و وضعیت',
        roadmapStage: 9,
        permissions: ['catalog.read'],
      },
      {
        id: 'inventory',
        label: 'انبار و موجودی',
        shortLabel: 'انبار',
        href: '/inventory',
        icon: 'inventory',
        description: 'موجودی، رزرو و اصلاحات',
        roadmapStage: 11,
        permissions: ['inventory.read'],
      },
    ],
  },
  {
    id: 'operations',
    label: 'عملیات اجرایی',
    items: [
      {
        id: 'plating',
        label: 'صف آبکاری',
        shortLabel: 'آبکاری',
        href: '/plating',
        icon: 'plating',
        description: 'شروع، تکمیل و کنترل SLA',
        roadmapStage: 23,
        permissions: ['orders.read'],
      },
      {
        id: 'fulfillment',
        label: 'آماده‌سازی و ارسال',
        shortLabel: 'ارسال',
        href: '/fulfillment',
        icon: 'fulfillment',
        description: 'صف بسته‌بندی، ارسال و موارد مسدود',
        roadmapStage: 24,
        permissions: ['orders.read'],
      },
    ],
  },
  {
    id: 'finance',
    label: 'مالی و تأمین',
    items: [
      {
        id: 'finance',
        label: 'پرداخت و مالی',
        shortLabel: 'مالی',
        href: '/finance',
        icon: 'finance',
        description: 'تراکنش، مغایرت و گزارش مالی',
        roadmapStage: 19,
        permissions: ['finance.read'],
      },
      {
        id: 'suppliers',
        label: 'تأمین‌کنندگان',
        shortLabel: 'تأمین',
        href: '/suppliers',
        icon: 'suppliers',
        description: 'بدهی، اعتبار و تسویه',
        roadmapStage: 13,
        permissions: ['finance.read'],
      },
    ],
  },
  {
    id: 'management',
    label: 'مدیریت سامانه',
    items: [
      {
        id: 'content',
        label: 'محتوا و سایت',
        shortLabel: 'محتوا',
        href: '/content',
        icon: 'content',
        description: 'صفحات، بخش‌ها و تنظیمات نمایشی',
        roadmapStage: 32,
        permissions: ['cms.read'],
      },
      {
        id: 'users',
        label: 'کاربران و دسترسی',
        shortLabel: 'کاربران',
        href: '/users',
        icon: 'users',
        description: 'حساب‌ها، نقش‌ها و permissionها',
        roadmapStage: 34,
        permissions: ['users.read'],
      },
      {
        id: 'settings',
        label: 'تنظیمات سامانه',
        shortLabel: 'تنظیمات',
        href: '/settings',
        icon: 'settings',
        description: 'تنظیمات حساس کسب‌وکار',
        roadmapStage: 32,
        permissions: ['settings.read'],
      },
      {
        id: 'audit',
        label: 'گزارش فعالیت',
        shortLabel: 'Audit',
        href: '/audit',
        icon: 'audit',
        description: 'ردیابی عملیات حساس',
        roadmapStage: 37,
        permissions: ['audit.read'],
      },
    ],
  },
];

function toNavigationItem(item: AdminNavigationDefinition): AdminNavigationItem {
  return {
    id: item.id,
    label: item.label,
    shortLabel: item.shortLabel,
    href: item.href,
    icon: item.icon,
    description: item.description,
    roadmapStage: item.roadmapStage,
  };
}

export function getAdminNavigation(user: AdminCurrentUser): readonly AdminNavigationGroup[] {
  return NAVIGATION_DEFINITIONS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items
      .filter((item) => hasAllAdminPermissions(user, item.permissions))
      .map(toNavigationItem),
  })).filter((group) => group.items.length > 0);
}

export function getAdminSection(section: string): AdminNavigationDefinition | undefined {
  return NAVIGATION_DEFINITIONS.flatMap((group) => group.items).find(
    (item) => item.href === `/${section}`,
  );
}

export function findAdminNavigationItem(
  pathname: string,
  navigation: readonly AdminNavigationGroup[],
): AdminNavigationItem | undefined {
  const items = navigation.flatMap((group) => group.items);

  return items
    .filter(
      (item) =>
        (item.href === '/' && pathname === '/') ||
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`),
    )
    .sort((first, second) => second.href.length - first.href.length)[0];
}

export function isAdminNavigationItemActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
