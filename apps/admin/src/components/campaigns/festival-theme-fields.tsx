'use client';

import type { components } from '@hamidian/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';

export type FestivalTheme = components['schemas']['FestivalThemeDto'];
type CardTheme = NonNullable<FestivalTheme['card']>;

const colors = [
  ['background', 'پس‌زمینه'],
  ['surface', 'سطح کارت‌ها'],
  ['foreground', 'متن'],
  ['accent', 'رنگ تأکید'],
  ['gradient', 'رنگ آغاز گرادیان'],
] as const;

const selectClass = 'min-h-10 min-w-0 rounded-md border border-[var(--admin-color-border)] px-2';

const cardColors = [
  ['surface', 'سطح کارت محصول', 'surface'],
  ['border', 'حاشیهٔ کارت', 'accent'],
  ['discount', 'نشان درصد تخفیف', 'foreground'],
  ['tag', 'برچسب جشنواره', 'foreground'],
  ['price', 'قیمت تخفیفی', 'foreground'],
  ['quota', 'نوار سهمیه', 'foreground'],
  ['action', 'دکمه و آیکون علاقه‌مندی', 'foreground'],
] as const;

function FestivalCardThemeFields({
  theme,
  onChange,
}: {
  theme: FestivalTheme;
  onChange: (theme: FestivalTheme) => void;
}) {
  const card = theme.card ?? {};
  const change = (values: Partial<CardTheme>) =>
    onChange({ ...theme, card: { ...card, ...values } });

  return (
    <details className="col-span-full rounded-md border border-[var(--admin-color-border)] p-3">
      <summary className="cursor-pointer text-sm font-semibold">ظاهر کارت محصولات جشنواره</summary>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cardColors.map(([key, label, fallback]) => (
          <div key={key} className="grid min-w-0 gap-1 text-sm">
            <label className="grid gap-1">
              {label}
              <Input
                type="color"
                value={card[key] ?? theme[fallback]}
                onChange={(event) => change({ [key]: event.currentTarget.value })}
              />
            </label>
            {card[key] && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`بازگرداندن رنگ ${label} به رنگ تم`}
                onClick={() => change({ [key]: undefined })}
              >
                رنگ تم
              </Button>
            )}
          </div>
        ))}
        <label className="grid min-w-0 gap-1 text-sm">
          فاصله‌گذاری محتوا
          <select
            className={selectClass}
            value={card.density ?? 'STANDARD'}
            onChange={(event) =>
              change({ density: event.currentTarget.value === 'COMPACT' ? 'COMPACT' : 'STANDARD' })
            }
          >
            <option value="STANDARD">معمولی</option>
            <option value="COMPACT">فشرده</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          سایهٔ کارت
          <select
            className={selectClass}
            value={card.shadow ?? 'NONE'}
            onChange={(event) =>
              change({ shadow: event.currentTarget.value === 'SOFT' ? 'SOFT' : 'NONE' })
            }
          >
            <option value="NONE">بدون سایه</option>
            <option value="SOFT">ملایم</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={card.hoverEmphasis ?? true}
            onChange={(event) => change({ hoverEmphasis: event.currentTarget.checked })}
          />
          برجسته شدن حاشیه با اشاره‌گر
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={card.showDescription ?? true}
            onChange={(event) => change({ showDescription: event.currentTarget.checked })}
          />
          نمایش توضیح کوتاه محصول
        </label>
      </div>
      {theme.card && (
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          onClick={() => onChange({ ...theme, card: undefined })}
        >
          بازنشانی ظاهر کارت
        </Button>
      )}
    </details>
  );
}

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
      <FestivalCardThemeFields theme={theme} onChange={onChange} />
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
        style={{
          backgroundColor: theme.card?.surface ?? theme.surface,
          borderColor: theme.card?.border ?? theme.accent,
        }}
      >
        نمونهٔ متن روی سطح کارت
      </p>
    </div>
  );
}
