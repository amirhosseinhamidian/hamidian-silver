export const AUDIT_OPERATION_TYPES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'PRICE_CHANGE',
  'STATUS_CHANGE',
  'STOCK_ADJUSTMENT',
  'PERMISSION_CHANGE',
] as const;

export type AuditOperationType = (typeof AUDIT_OPERATION_TYPES)[number];
export type AuditChangeValue = string | number | boolean | null | readonly string[];

export type AuditChange = Readonly<{
  field: string;
  label: string;
  before: AuditChangeValue;
  after: AuditChangeValue;
}>;

export type HumanAuditEvent = Readonly<{
  title: string;
  operationType: AuditOperationType;
  entityName: string | null;
  changes: readonly AuditChange[];
}>;

type AuditTarget = Readonly<{
  action: string;
  resource: string;
  method: string;
}>;

const HUMAN_AUDIT_EVENT = Symbol('human-audit-event');
const SENSITIVE_FIELD_PATTERN =
  /(password|passcode|token|secret|credential|authorization|cookie|otp|cvv|card|gateway|merchant|api[-_]?key|session|authority|transaction|external.*reference)/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(password|passcode|token|secret|credential|authorization|cookie|otp|cvv|api[-_]?key|session)\b\s*[:=]\s*([^\s,;]+)/gi;
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}(?:\.[a-z0-9_-]{8,})?\b/gi;

const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  'admin-roles': 'نقش کاربری',
  catalog: 'کاتالوگ',
  finance: 'اطلاعات مالی',
  inventory: 'موجودی',
  notifications: 'اعلان',
  orders: 'سفارش',
  payments: 'پرداخت',
  pricing: 'قیمت‌گذاری',
  roles: 'نقش کاربری',
  'site-settings': 'تنظیمات سایت',
  users: 'کاربر',
};

type AuditedValue = {
  [HUMAN_AUDIT_EVENT]?: HumanAuditEvent;
};

function inferOperationType(action: string, method: string): AuditOperationType {
  if (action.includes('/sale-price')) return 'PRICE_CHANGE';
  if (action.includes('/status')) return 'STATUS_CHANGE';
  if (action.includes('/stock/')) return 'STOCK_ADJUSTMENT';
  if (action.includes('/permissions')) return 'PERMISSION_CHANGE';
  if (method === 'POST') return 'CREATE';
  if (method === 'DELETE') return 'DELETE';
  return 'UPDATE';
}

function fallbackTitle(
  resource: string,
  operationType: AuditOperationType,
  outcome: 'SUCCESS' | 'FAILURE',
): string {
  const entity = RESOURCE_NAMES[resource] ?? resource.replaceAll('-', ' ');
  const operation =
    operationType === 'CREATE'
      ? `ایجاد ${entity}`
      : operationType === 'DELETE'
        ? `حذف ${entity}`
        : operationType === 'PRICE_CHANGE'
          ? `تغییر قیمت ${entity}`
          : operationType === 'STATUS_CHANGE'
            ? `تغییر وضعیت ${entity}`
            : operationType === 'STOCK_ADJUSTMENT'
              ? `اصلاح ${entity}`
              : operationType === 'PERMISSION_CHANGE'
                ? `تغییر دسترسی ${entity}`
                : `ویرایش ${entity}`;

  return outcome === 'FAILURE' ? `تلاش ناموفق برای ${operation}` : `${operation} انجام شد.`;
}

export function sanitizeAuditText(value: string, maxLength: number): string {
  return value
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1=[REDACTED]')
    .slice(0, maxLength);
}

function sanitizeValue(value: AuditChangeValue): AuditChangeValue {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .slice(0, 100)
      .map((item) => sanitizeAuditText(item, 500));
  }
  return typeof value === 'string' ? sanitizeAuditText(value, 500) : value;
}

export function sanitizeHumanAuditEvent(event: HumanAuditEvent): HumanAuditEvent {
  return {
    title: sanitizeAuditText(event.title.trim(), 500),
    operationType: event.operationType,
    entityName: event.entityName ? sanitizeAuditText(event.entityName.trim(), 200) || null : null,
    changes: event.changes
      .filter(
        (change) =>
          !SENSITIVE_FIELD_PATTERN.test(change.field) &&
          !SENSITIVE_FIELD_PATTERN.test(change.label),
      )
      .slice(0, 30)
      .map((change) => ({
        field: change.field.slice(0, 100),
        label: change.label.slice(0, 100),
        before: sanitizeValue(change.before),
        after: sanitizeValue(change.after),
      })),
  };
}

export function attachHumanAuditEvent<T extends object>(value: T, event: HumanAuditEvent): T {
  Object.defineProperty(value, HUMAN_AUDIT_EVENT, {
    configurable: false,
    enumerable: false,
    value: sanitizeHumanAuditEvent(event),
    writable: false,
  });
  return value;
}

export function resolveHumanAuditEvent(
  value: unknown,
  target: AuditTarget,
  outcome: 'SUCCESS' | 'FAILURE',
): HumanAuditEvent {
  const attached =
    outcome === 'SUCCESS' && typeof value === 'object' && value !== null
      ? (value as AuditedValue)[HUMAN_AUDIT_EVENT]
      : undefined;
  if (attached) return sanitizeHumanAuditEvent(attached);

  const operationType = inferOperationType(target.action, target.method);
  return {
    title: fallbackTitle(target.resource, operationType, outcome),
    operationType,
    entityName: RESOURCE_NAMES[target.resource] ?? null,
    changes: [],
  };
}
