export type ParsedProductAttribute = Readonly<{
  key: string;
  value: string;
}>;

export type ProductAttributeParseResult =
  | Readonly<{ ok: true; attributes: readonly ParsedProductAttribute[] }>
  | Readonly<{ ok: false; message: string }>;

const MAX_ATTRIBUTES = 30;
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 500;
const persianNumber = new Intl.NumberFormat('fa-IR');

export function normalizeProductAttributeKey(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('fa-IR');
}

export function parseProductAttributesText(input: string): ProductAttributeParseResult {
  const lines = input
    .split(/\r?\n/u)
    .map((value, index) => ({ value: value.trim(), number: index + 1 }))
    .filter(({ value }) => value.length > 0);

  if (lines.length === 0) {
    return { ok: false, message: 'حداقل یک ویژگی با قالب «کلید: مقدار» وارد کنید.' };
  }
  if (lines.length > MAX_ATTRIBUTES) {
    return { ok: false, message: 'در هر بار حداکثر ۳۰ ویژگی قابل تبدیل است.' };
  }

  const attributes: ParsedProductAttribute[] = [];
  const keys = new Set<string>();

  for (const line of lines) {
    const separatorIndex = line.value.search(/[:：]/u);
    const key = separatorIndex < 0 ? '' : line.value.slice(0, separatorIndex).trim();
    const value = separatorIndex < 0 ? '' : line.value.slice(separatorIndex + 1).trim();
    const lineNumber = persianNumber.format(line.number);

    if (!key || !value) {
      return {
        ok: false,
        message: `خط ${lineNumber} باید با قالب «کلید: مقدار» و هر دو بخش کامل باشد.`,
      };
    }
    if (key.length > MAX_KEY_LENGTH || value.length > MAX_VALUE_LENGTH) {
      return {
        ok: false,
        message: `خط ${lineNumber} از محدودیت ۱۰۰ نویسه برای کلید یا ۵۰۰ نویسه برای مقدار بیشتر است.`,
      };
    }

    const normalizedKey = normalizeProductAttributeKey(key);
    if (keys.has(normalizedKey)) {
      return {
        ok: false,
        message: `کلید «${key}» در متن ورودی تکرار شده است.`,
      };
    }
    keys.add(normalizedKey);
    attributes.push({ key: key.replace(/\s+/gu, ' '), value });
  }

  return { ok: true, attributes };
}
