import { BadRequestException } from '@nestjs/common';

const timeZone = 'Asia/Tehran';
const day = 86_400_000;
const minute = 60_000;
const persianDate = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const tehranOffset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });

export function formatTehranDate(date: Date): string {
  const parts = Object.fromEntries(
    persianDate.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year.padStart(4, '0')}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

export function parseTehranDate(value: string): Date {
  const normalized = value
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 0xf));
  const match =
    /^([1-9]\d{3})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d)$/.exec(
      normalized,
    );
  const invalid = () =>
    new BadRequestException('Enter an unambiguous Solar Hijri date and time in Tehran.');
  if (!match) throw invalid();

  const gregorianYear = Number(match[1]) + 621;
  const target = normalized.slice(0, 10);
  let first = Date.UTC(gregorianYear, 0, 1) / day;
  let last = Date.UTC(gregorianYear + 1, 3, 1) / day;
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    const current = formatTehranDate(new Date(middle * day + 12 * 60 * minute)).slice(0, 10);
    if (current < target) first = middle + 1;
    else last = middle;
  }

  const midnight = first * day;
  const local = midnight + (Number(match[4]) * 60 + Number(match[5])) * minute;
  const candidates = new Set<number>();
  // Try both sides of an offset change and reject gaps and repeated wall times.
  for (const sample of [midnight - day, midnight + day]) {
    const offsetPart = tehranOffset
      .formatToParts(sample)
      .find((part) => part.type === 'timeZoneName');
    const offset = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(offsetPart?.value ?? '');
    if (!offset) continue;
    const seconds = (Number(offset[2]) * 60 + Number(offset[3])) * 60 + Number(offset[4] ?? 0);
    const instant = local - (offset[1] === '+' ? 1 : -1) * seconds * 1000;
    if (formatTehranDate(new Date(instant)) === normalized) candidates.add(instant);
  }
  const [instant] = candidates;
  if (candidates.size !== 1) throw invalid();
  return new Date(instant);
}
