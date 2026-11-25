'use client';

import type { components } from '@hamidian/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';

export type FestivalTheme = components['schemas']['FestivalThemeDto'];

const colors = [
  ['background', 'پس‌زمینه'],
  ['surface', 'سطح کارت‌ها'],
  ['foreground', 'متن'],
  ['accent', 'رنگ تأکید'],
  ['gradient', 'رنگ آغاز گرادیان'],
] as const;

const selectClass = 'min-h-10 min-w-0 rounded-md border border-[var(--admin-color-border)] px-2';

export function FestivalThemeFields({
  theme,
  onChange,
}: {
  theme: FestivalTheme;
  onChange: (theme: FestivalTheme) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {colors.map(([key, label]) => (
        <label key={key} className="grid min-w-0 gap-1 text-sm">
          {label}
          <Input
            type="color"
            value={theme[key] ?? theme.background}
            onChange={(event) => onChange({ ...theme, [key]: event.currentTarget.value })}
          />
        </label>
      ))}
      <label className="grid min-w-0 gap-1 text-sm">
        نقش پس‌زمینه
        <select
          className={selectClass}
          value={theme.decoration}
          onChange={(event) =>
            onChange({
              ...theme,
              decoration: event.currentTarget.value as FestivalTheme['decoration'],
            })
          }
        >
          <option value="NONE">ساده</option>
          <option value="DOTS">نقطه‌ای</option>
          <option value="LINES">خطی</option>
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        حرکت اسلایدها
        <select
          className={selectClass}
          value={theme.motion}
          onChange={(event) =>
            onChange({ ...theme, motion: event.currentTarget.value as FestivalTheme['motion'] })
          }
        >
          <option value="STILL">با کنترل دستی</option>
          <option value="SOFT">چرخش خودکار</option>
        </select>
      </label>
      {theme.gradient && (
        <Button
          size="sm"
          variant="outline"
          className="self-end justify-self-start"
          onClick={() => onChange({ ...theme, gradient: undefined })}
        >
          حذف گرادیان
        </Button>
      )}
    </div>
  );
}

export function FestivalThemePreview({ theme, name }: { theme: FestivalTheme; name: string }) {
  const backgroundImage = theme.gradient
    ? `linear-gradient(155deg, ${theme.gradient}, ${theme.background})`
    : undefined;
  return (
    <div
      className="rounded-md border p-3 text-sm"
      style={{ backgroundColor: theme.background, color: theme.foreground, backgroundImage }}
      aria-label="پیش‌نمایش رنگ‌های تم"
    >
      <p className="font-semibold [overflow-wrap:anywhere]">{name}</p>
      <p
        className="mt-2 rounded-md border px-2 py-1 text-xs"
        style={{ backgroundColor: theme.surface, borderColor: theme.accent }}
      >
        نمونهٔ متن روی سطح کارت
      </p>
    </div>
  );
}
