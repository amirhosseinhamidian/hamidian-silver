export type AdminCardToCardAccount = Readonly<{
  id: string;
  cardNumber: string;
  ibanNumber: string | null;
  holderName: string;
  bankName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCardToCardAccount(value: unknown): AdminCardToCardAccount | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.cardNumber !== 'string' ||
    !/^\d{16}$/.test(value.cardNumber) ||
    (value.ibanNumber !== null &&
      (typeof value.ibanNumber !== 'string' || !/^\d{24}$/.test(value.ibanNumber))) ||
    typeof value.holderName !== 'string' ||
    typeof value.bankName !== 'string' ||
    typeof value.isActive !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    cardNumber: value.cardNumber,
    ibanNumber: value.ibanNumber,
    holderName: value.holderName,
    bankName: value.bankName,
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseCardToCardAccounts(value: unknown): readonly AdminCardToCardAccount[] | null {
  if (!Array.isArray(value)) return null;
  const accounts = value.map(parseCardToCardAccount);
  return accounts.some((account) => account === null)
    ? null
    : (accounts as AdminCardToCardAccount[]);
}
