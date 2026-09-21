export type OrderNotificationRecipient = Readonly<{
  userId: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  roles: readonly ('MANAGER' | 'ADMIN')[];
  telegramChatId: string | null;
  baleChatId: string | null;
}>;

export type OrderNotificationRecipientsSnapshot = Readonly<{
  telegramConfigured: boolean;
  baleConfigured: boolean;
  recipients: readonly OrderNotificationRecipient[];
}>;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

function recipient(value: unknown): OrderNotificationRecipient | null {
  const source = record(value);
  const rawRoles = Array.isArray(source?.roles) ? source.roles : null;
  const roles = rawRoles
    ? rawRoles.filter((role): role is 'MANAGER' | 'ADMIN' => role === 'MANAGER' || role === 'ADMIN')
    : null;
  const firstName = nullableText(source?.firstName);
  const lastName = nullableText(source?.lastName);
  const telegramChatId = nullableText(source?.telegramChatId);
  const baleChatId = nullableText(source?.baleChatId);
  if (
    !source ||
    typeof source.userId !== 'string' ||
    typeof source.phone !== 'string' ||
    firstName === undefined ||
    lastName === undefined ||
    telegramChatId === undefined ||
    baleChatId === undefined ||
    !roles ||
    roles.length !== rawRoles?.length
  )
    return null;
  return {
    userId: source.userId,
    phone: source.phone,
    firstName,
    lastName,
    roles,
    telegramChatId,
    baleChatId,
  };
}

export function parseOrderNotificationRecipientsSnapshot(
  value: unknown,
): OrderNotificationRecipientsSnapshot | null {
  const source = record(value);
  const recipients = Array.isArray(source?.recipients) ? source.recipients.map(recipient) : null;
  if (
    !source ||
    typeof source.telegramConfigured !== 'boolean' ||
    typeof source.baleConfigured !== 'boolean' ||
    !recipients ||
    recipients.some((item) => !item)
  )
    return null;
  return {
    telegramConfigured: source.telegramConfigured,
    baleConfigured: source.baleConfigured,
    recipients: recipients as OrderNotificationRecipient[],
  };
}
