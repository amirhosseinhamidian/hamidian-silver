import { toAsciiDigits } from './formatters';

export type CalendarSystem = 'persian' | 'gregory';
export type CalendarValueKind = 'date-time' | 'date';

export const calendarDayMilliseconds = 86_400_000;

const persianDate = new Intl.DateTimeFormat('en-GB-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const tehranToday = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateParts(formatter: Intl.DateTimeFormat, date: number | Date) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function calendarParts(date: number, calendar: CalendarSystem) {
  if (calendar === 'persian') return dateParts(persianDate, date);
  const value = new Date(date);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function todayInTehran(now: Date) {
  const { year, month, day } = dateParts(tehranToday, now);
  return Date.UTC(year, month - 1, day);
}

function dateKey({ year, month, day }: ReturnType<typeof calendarParts>) {
  return year * 10_000 + month * 100 + day;
}

// These UTC day numbers identify civil dates. Tehran wall time is sent separately to the API.
export function calendarDay(calendar: CalendarSystem, year: number, month: number, day: number) {
  const target = dateKey({ year, month, day });
  let date = Date.UTC(year, month - 1, day);
  if (calendar === 'persian') {
    const gregorianYear = year + 621;
    let first = Date.UTC(gregorianYear, 0, 1) / calendarDayMilliseconds;
    let last = Date.UTC(gregorianYear + 1, 3, 1) / calendarDayMilliseconds;
    while (first < last) {
      const middle = Math.floor((first + last) / 2);
      if (dateKey(calendarParts(middle * calendarDayMilliseconds, calendar)) < target) {
        first = middle + 1;
      } else {
        last = middle;
      }
    }
    date = first * calendarDayMilliseconds;
  }
  return dateKey(calendarParts(date, calendar)) === target ? date : null;
}

export function calendarMonth(calendar: CalendarSystem, year: number, month: number) {
  const start = calendarDay(calendar, year, month, 1);
  const next = calendarDay(calendar, month === 12 ? year + 1 : year, (month % 12) + 1, 1);
  if (start === null || next === null) return null;
  return {
    start,
    length: (next - start) / calendarDayMilliseconds,
    leading: (new Date(start).getUTCDay() + 1) % 7,
  };
}

export function formatCalendarDay(date: number, calendar: CalendarSystem) {
  const { year, month, day } = calendarParts(date, calendar);
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join(calendar === 'persian' ? '/' : '-');
}

export function readCalendarValue(value: string, kind: CalendarValueKind) {
  const normalized = toAsciiDigits(value.trim());
  const match =
    kind === 'date-time'
      ? /^([1-9]\d{3})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d)$/.exec(
          normalized,
        )
      : /^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(normalized);
  if (!match) return null;
  const day = calendarDay(
    kind === 'date-time' ? 'persian' : 'gregory',
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
  return day === null ? null : { day, time: kind === 'date-time' ? `${match[4]}:${match[5]}` : '' };
}
