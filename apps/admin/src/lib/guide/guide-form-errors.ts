export type GuideFormIssue = Readonly<{
  message: string;
  fieldId?: string;
  blockIndex?: number;
}>;

const number = new Intl.NumberFormat('fa-IR');

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function messageFrom(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    return messages.length ? messages.join('، ') : null;
  }
  return null;
}

function blockFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    anchorId: 'شناسه لینک داخلی',
    content: 'محتوای بلوک',
    primaryMediaId: 'تصویر بلوک',
    type: 'نوع بلوک',
    variant: 'سبک نمایش',
  };
  return labels[field] ?? 'اطلاعات بلوک';
}

function blockFieldId(clientId: string, field: string): string {
  const suffixes: Record<string, string> = {
    anchorId: 'anchor',
    content: 'body',
    primaryMediaId: 'body',
    type: 'type',
    variant: 'variant',
  };
  return `guide-block-${clientId}-${suffixes[field] ?? 'body'}`;
}

function explainBlockMessage(rawMessage: string, field: string): string {
  if (field === 'anchorId' && /must match|regular expression/i.test(rawMessage))
    return 'فقط حروف انگلیسی کوچک، عدد و خط تیره مجاز است؛ مانند silver-care.';
  if (/must not be empty|should not be empty|is required/i.test(rawMessage))
    return 'این مقدار الزامی است.';
  if (/must be a UUID/i.test(rawMessage)) return 'شناسه انتخاب‌شده معتبر نیست.';
  return rawMessage;
}

export function guideSaveIssue(
  payload: unknown,
  blockClientIds: readonly string[],
  fallback = 'ذخیره دانستنی انجام نشد.',
): GuideFormIssue {
  const root = record(payload);
  const nestedError = record(root?.error);
  const rawMessage =
    messageFrom(nestedError?.message) ??
    messageFrom(root?.message) ??
    messageFrom(payload) ??
    fallback;
  const blockMatch = rawMessage.match(/(?:^|\s)blocks\.(\d+)\.([A-Za-z0-9_]+)/);

  if (blockMatch) {
    const blockIndex = Number(blockMatch[1]);
    const field = blockMatch[2] ?? '';
    const clientId = blockClientIds[blockIndex];
    return {
      message: `خطا در بخش ${number.format(blockIndex + 1)}، «${blockFieldLabel(field)}»: ${explainBlockMessage(rawMessage, field)}`,
      fieldId: clientId ? blockFieldId(clientId, field) : undefined,
      blockIndex,
    };
  }

  const fieldMap: readonly [RegExp, string, string][] = [
    [/(?:^|\s)title\b/, 'guide-title', 'عنوان'],
    [/(?:^|\s)slug\b/, 'guide-slug', 'اسلاگ'],
    [/(?:^|\s)excerpt\b/, 'guide-excerpt', 'خلاصه'],
    [/(?:^|\s)seoCanonicalPath\b/, 'seo-canonical-path', 'مسیر canonical'],
    [/(?:^|\s)readingTimeMinutes\b/, 'guide-reading-time', 'زمان مطالعه'],
  ];
  const matchedField = fieldMap.find(([pattern]) => pattern.test(rawMessage));
  if (matchedField)
    return {
      message: `خطا در بخش «${matchedField[2]}»: ${rawMessage}`,
      fieldId: matchedField[1],
    };

  return { message: rawMessage };
}
