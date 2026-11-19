import type { components } from '@hamidian/contracts';
import { toAsciiDigits } from '@/lib/presentation/formatters';

export type AttributeDefinition = components['schemas']['CatalogAttributeDefinitionDto'];
export type AttributeConfig = Omit<AttributeDefinition, 'code' | 'version'>;
export type AttributeValue = components['schemas']['CatalogAttributeValueDto'];
export type ProductTypedAttribute = components['schemas']['CatalogProductAttributeDto'];
export type ProductAttributeChange = Pick<
  components['schemas']['SetCatalogProductAttributeDto'],
  'value' | 'legacyValue' | 'clear'
>;

export const ATTRIBUTE_KIND_LABELS: Readonly<Record<AttributeConfig['kind'], string>> = {
  SELECT: 'تک‌انتخابی',
  MULTI_SELECT: 'چندانتخابی',
  NUMBER: 'عددی',
  RANGE: 'بازه',
  BOOLEAN: 'بله یا خیر',
};
export const ATTRIBUTE_UNIT_LABELS: Readonly<Record<AttributeConfig['unit'], string>> = {
  NONE: 'بدون واحد',
  MILLIMETER: 'میلی‌متر',
  GRAM: 'گرم',
  SIZE: 'سایز کاتالوگ',
  PER_MILLE: 'در هزار',
  BAR: 'بار',
};
export const ATTRIBUTE_SOURCE_LABELS: Readonly<Record<AttributeConfig['source'], string>> = {
  MANUAL: 'مقدار محصول',
  VARIANT_SIZE: 'سایز تنوع',
  VARIANT_LENGTH: 'طول تنوع',
  VARIANT_WEIGHT: 'وزن تنوع',
};

function decimal(input: string): number {
  const normalized = toAsciiDigits(input.trim()).replace('٫', '.');
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(normalized)) throw new Error('مقدار عددی معتبر نیست.');
  return Number(normalized);
}

export function attributeValueFromText(
  text: string,
  config: Pick<AttributeConfig, 'kind' | 'unit'>,
): AttributeValue {
  const input = text.trim();
  if (!input) throw new Error('مقدار ویژگی را وارد کنید.');
  switch (config.kind) {
    case 'SELECT':
      return { optionCode: input };
    case 'MULTI_SELECT':
      return { optionCodes: input.split(/[,،]/).map((value) => value.trim()) };
    case 'NUMBER':
      return { number: decimal(input), unit: config.unit };
    case 'RANGE': {
      const parts = input.split('..');
      if (parts.length !== 2) throw new Error('بازه را به شکل ۱۰..۲۰ وارد کنید.');
      return { min: decimal(parts[0]), max: decimal(parts[1]), unit: config.unit };
    }
    case 'BOOLEAN':
      if (input === 'بله' || input === 'true') return { boolean: true };
      if (input === 'خیر' || input === 'false') return { boolean: false };
      throw new Error('مقدار ویژگی باید «بله» یا «خیر» باشد.');
  }
}

export function attributeValueText(value: AttributeValue | null): string {
  if (!value) return '';
  if (value.optionCode !== undefined) return value.optionCode;
  if (value.optionCodes !== undefined) return value.optionCodes.join('، ');
  if (value.number !== undefined) return String(value.number);
  if (value.min !== undefined && value.max !== undefined) return `${value.min}..${value.max}`;
  return value.boolean === undefined ? '' : value.boolean ? 'بله' : 'خیر';
}

export function parseAttributePairs(input: string): [string, string][] {
  return input
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const separator = line.indexOf('|');
      const left = line.slice(0, separator).trim();
      const right = line.slice(separator + 1).trim();
      if (separator < 0 || !left || !right) throw new Error('در هر سطر دو مقدار را با | جدا کنید.');
      return [left, right];
    });
}

export async function saveCatalogAttribute(
  path: string,
  method: 'POST' | 'PATCH',
  value: unknown,
): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (response.ok) return;
  if (response.status === 409)
    throw new Error('اطلاعات هم‌زمان تغییر کرده است. صفحه را تازه کنید.');
  if (response.status === 400)
    throw new Error('نوع، واحد، دامنهٔ دسته یا نگاشت مقدار را بررسی کنید.');
  throw new Error('ذخیرهٔ ویژگی انجام نشد.');
}
