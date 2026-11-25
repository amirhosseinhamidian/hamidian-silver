import { describe, expect, it } from 'vitest';

import {
  calendarDay,
  calendarMonth,
  formatCalendarDay,
  readCalendarValue,
  todayInTehran,
} from './dual-calendar';

describe('dual calendar', () => {
  it('round-trips Persian dates and their Tehran wall time through the Gregorian display', () => {
    const picked = readCalendarValue('۱۴۰۳/۰۱/۰۱ ۰۰:۱۵', 'date-time');
    expect(picked).not.toBeNull();
    const { day, time } = picked!;
    expect(formatCalendarDay(day, 'gregory')).toBe('2024-03-20');
    expect(calendarDay('gregory', 2024, 3, 20)).toBe(day);
    expect(formatCalendarDay(day, 'persian')).toBe('1403/01/01');
    expect(time).toBe('00:15');
  });

  it('handles leap years, invalid wall times and Saturday-first grids', () => {
    expect(calendarMonth('persian', 1403, 12)).toMatchObject({ length: 30 });
    expect(calendarMonth('persian', 1402, 12)).toMatchObject({ length: 29 });
    expect(calendarMonth('gregory', 2024, 2)).toMatchObject({ length: 29 });
    expect(calendarMonth('gregory', 2026, 2)).toMatchObject({ length: 28 });
    expect(calendarMonth('gregory', 2026, 11)).toMatchObject({ leading: 1 });
    expect(readCalendarValue('1402/12/30 07:00', 'date-time')).toBeNull();
    expect(readCalendarValue('1403/12/30 24:00', 'date-time')).toBeNull();
    expect(readCalendarValue('2026-02-29', 'date')).toBeNull();
  });

  it('opens to the Tehran day near UTC midnight', () => {
    const today = todayInTehran(new Date('2026-11-25T21:00:00Z'));
    expect(formatCalendarDay(today, 'gregory')).toBe('2026-11-26');
  });

  it('converts consecutive days across both calendar year boundaries', () => {
    const esfand = calendarDay('persian', 1403, 12, 30)!;
    const nowruz = calendarDay('persian', 1404, 1, 1)!;
    expect(formatCalendarDay(esfand, 'gregory')).toBe('2025-03-20');
    expect(formatCalendarDay(nowruz, 'gregory')).toBe('2025-03-21');
    expect(calendarMonth('gregory', 2025, 12)).toMatchObject({ length: 31 });
    expect(formatCalendarDay(calendarDay('gregory', 2026, 1, 1)!, 'persian')).toBe('1404/10/11');
  });
});
