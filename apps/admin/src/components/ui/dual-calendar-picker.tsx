'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  calendarDay,
  calendarDayMilliseconds,
  calendarMonth,
  calendarParts,
  formatCalendarDay,
  readCalendarValue,
  todayInTehran,
  type CalendarSystem,
  type CalendarValueKind,
} from '@/lib/presentation/dual-calendar';
import { toPersianDigits } from '@/lib/presentation/formatters';

const months = {
  persian: [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ],
  gregory: [
    'ژانویه',
    'فوریه',
    'مارس',
    'آوریل',
    'مه',
    'ژوئن',
    'ژوئیه',
    'اوت',
    'سپتامبر',
    'اکتبر',
    'نوامبر',
    'دسامبر',
  ],
};
const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
const selectStyle =
  'min-h-10 w-full min-w-0 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-2 text-sm outline-none focus-visible:shadow-[var(--admin-focus-ring)]';
const keyboardDaySteps: Readonly<Partial<Record<string, number>>> = {
  ArrowLeft: 1,
  ArrowRight: -1,
  ArrowUp: -7,
  ArrowDown: 7,
};

type Props = Readonly<{
  label: string;
  name?: string;
  kind?: CalendarValueKind;
  required?: boolean;
  error?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}>;

function formatFormValue(day: number, time: string, kind: CalendarValueKind) {
  return kind === 'date'
    ? formatCalendarDay(day, 'gregory')
    : `${formatCalendarDay(day, 'persian')} ${time}`;
}

export function DualCalendarPicker({
  label,
  name,
  kind = 'date-time',
  required,
  error,
  defaultValue = '',
  value,
  onChange,
}: Props) {
  const id = useId();
  const [localValue, setLocalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [calendar, setCalendar] = useState<CalendarSystem>('persian');
  const [anchor, setAnchor] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const [time, setTime] = useState('00:00');
  const rawValue = value ?? localValue;
  const current = readCalendarValue(rawValue, kind);
  const currentFormValue = current ? formatFormValue(current.day, current.time, kind) : rawValue;
  const view = anchor === null ? null : calendarParts(anchor, calendar);
  const month = view && calendarMonth(calendar, view.year, view.month);
  const dayInMonth = (day: number | null) =>
    month &&
    day !== null &&
    day >= month.start &&
    day < month.start + month.length * calendarDayMilliseconds;
  const tabStop = dayInMonth(focusedDay)
    ? focusedDay
    : dayInMonth(selectedDay)
      ? selectedDay
      : month?.start;
  const [hour, minute] = time.split(':');

  function changeOpen(next: boolean) {
    if (next) {
      setAnchor(current?.day ?? todayInTehran(new Date()));
      setSelectedDay(current?.day ?? null);
      setFocusedDay(null);
      setTime(current?.time || '00:00');
    }
    setOpen(next);
  }

  function changeValue(next: string) {
    if (value === undefined) setLocalValue(next);
    onChange?.(next);
  }

  function showMonth(year: number, month: number) {
    setAnchor(calendarDay(calendar, year, month, 1));
  }

  const nextValue = selectedDay === null ? '' : formatFormValue(selectedDay, time, kind);
  const canApply = Boolean(readCalendarValue(nextValue, kind));

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[var(--admin-color-muted)]">
        {label}
        {required && (
          <span className="text-[var(--admin-color-danger)]" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {name && <input type="hidden" name={name} value={currentFormValue} />}
      {required && (
        <span id={`${id}-required`} className="sr-only">
          انتخاب الزامی است.
        </span>
      )}
      <Dialog open={open} onOpenChange={changeOpen}>
        <div className="flex items-center gap-2">
          <DialogTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className="min-w-0 flex-1 justify-start text-start"
              aria-label={label}
              aria-describedby={[
                `${id}-value`,
                required && `${id}-required`,
                error && `${id}-error`,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-invalid={error ? true : undefined}
              data-calendar-field={name}
            >
              <bdi id={`${id}-value`}>
                {current
                  ? toPersianDigits(
                      `${formatCalendarDay(current.day, calendar)}${current.time ? ` ${current.time}` : ''}`,
                    )
                  : kind === 'date'
                    ? 'انتخاب تاریخ'
                    : 'انتخاب تاریخ و ساعت'}
              </bdi>
            </Button>
          </DialogTrigger>
          {!required && rawValue && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`پاک کردن ${label}`}
              onClick={() => changeValue('')}
            >
              پاک کردن
            </Button>
          )}
        </div>
        {view && month && (
          <DialogContent
            title={label}
            description="زمان‌بندی بر اساس وقت تهران (Asia/Tehran) است."
            size="sm"
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="outline">انصراف</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button disabled={!canApply} onClick={() => changeValue(nextValue)}>
                    تأیید انتخاب
                  </Button>
                </DialogClose>
              </>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <label className="min-w-0 space-y-1 text-xs">
                  تقویم
                  <select
                    className={selectStyle}
                    value={calendar}
                    onChange={(event) => {
                      setCalendar(event.currentTarget.value === 'gregory' ? 'gregory' : 'persian');
                      if (selectedDay !== null) setAnchor(selectedDay);
                    }}
                  >
                    <option value="persian">شمسی</option>
                    <option value="gregory">میلادی</option>
                  </select>
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  سال
                  <select
                    className={selectStyle}
                    value={view.year}
                    onChange={(event) => showMonth(Number(event.currentTarget.value), view.month)}
                  >
                    {Array.from({ length: 21 }, (_, index) => view.year + index - 10).map(
                      (year) => (
                        <option key={year} value={year}>
                          {toPersianDigits(year)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  ماه
                  <select
                    className={selectStyle}
                    value={view.month}
                    onChange={(event) => showMonth(view.year, Number(event.currentTarget.value))}
                  >
                    {months[calendar].map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-7 gap-1" role="group" aria-label="روزهای ماه">
                {weekdays.map((weekday) => (
                  <span
                    className="text-center text-xs text-[var(--admin-color-muted)]"
                    key={weekday}
                    title={weekday}
                    aria-hidden="true"
                  >
                    {weekday.slice(0, 1)}
                  </span>
                ))}
                {Array.from({ length: month.leading }, (_, index) => (
                  <span key={`offset-${index}`} aria-hidden="true" />
                ))}
                {Array.from({ length: month.length }, (_, index) => {
                  const day = month.start + index * calendarDayMilliseconds;
                  return (
                    <Button
                      key={day}
                      size="sm"
                      variant={selectedDay === day ? 'primary' : 'outline'}
                      className="min-h-9 w-full px-0"
                      aria-pressed={selectedDay === day}
                      aria-label={`${toPersianDigits(index + 1)} ${months[calendar][view.month - 1]}`}
                      data-day={day}
                      tabIndex={day === tabStop ? 0 : -1}
                      onFocus={() => setFocusedDay(day)}
                      onKeyDown={(event) => {
                        const step = keyboardDaySteps[event.key];
                        if (step === undefined) return;
                        event.preventDefault();
                        const nextDay = day + step * calendarDayMilliseconds;
                        event.currentTarget.parentElement
                          ?.querySelector<HTMLButtonElement>(`button[data-day="${nextDay}"]`)
                          ?.focus();
                      }}
                      onClick={() => setSelectedDay(day)}
                    >
                      {toPersianDigits(index + 1)}
                    </Button>
                  );
                })}
              </div>
              {kind === 'date-time' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0 space-y-1 text-xs">
                    ساعت
                    <select
                      className={selectStyle}
                      value={hour}
                      onChange={(event) => setTime(`${event.currentTarget.value}:${minute}`)}
                    >
                      {hours.map((number) => (
                        <option key={number} value={number}>
                          {toPersianDigits(number)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 space-y-1 text-xs">
                    دقیقه
                    <select
                      className={selectStyle}
                      value={minute}
                      onChange={(event) => setTime(`${hour}:${event.currentTarget.value}`)}
                    >
                      {minutes.map((number) => (
                        <option key={number} value={number}>
                          {toPersianDigits(number)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[var(--admin-color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
