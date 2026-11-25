import type { components } from '@hamidian/contracts';
import { useState } from 'react';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';

type Slot = 'NAVIGATION' | 'COUNTDOWN';
type Appearance = components['schemas']['CampaignPlacementAppearanceDto'];

const motion = [
  { value: 'DEFAULT', label: 'پیش‌فرض جایگاه' },
  { value: 'NONE', label: 'بدون حرکت' },
  { value: 'SUBTLE', label: 'ملایم' },
  { value: 'EMPHASIS', label: 'برجسته' },
] as const;
const icons = [
  { value: 'DEFAULT', label: 'بدون آیکون' },
  { value: 'STAR', label: 'ستاره' },
  { value: 'TAG', label: 'برچسب' },
] as const;
const mediaFit = [
  { value: 'COVER', label: 'پوشش تمام عرض' },
  { value: 'CONTAIN', label: 'نمایش کامل تصویر' },
] as const;
const overlay = [
  { value: 'NONE', label: 'بدون پوشش' },
  { value: 'SOFT', label: 'نیمه‌تیره' },
  { value: 'STRONG', label: 'تیره' },
] as const;
const ctaStyle = [
  { value: 'LINK', label: 'پیوند متنی' },
  { value: 'SOLID', label: 'دکمهٔ رنگی' },
  { value: 'OUTLINE', label: 'دکمهٔ حاشیه‌دار' },
] as const;

export function readCampaignPlacementStyle(slot: Slot, text: (name: string) => string) {
  const read = (name: string) => text(`${slot}-${name}`);
  const useTheme = read('useTheme') === 'on';
  const effect = read('motion');
  const icon = read('icon');
  return {
    textColor: useTheme ? undefined : read('textColor') || undefined,
    display: {
      ...(useTheme
        ? { useTheme: true }
        : {
            backgroundColor: read('backgroundColor') || undefined,
            gradientColor: read('gradientColor') || undefined,
          }),
      motion:
        effect === 'NONE' || effect === 'SUBTLE' || effect === 'EMPHASIS' ? effect : undefined,
      ...(slot === 'NAVIGATION'
        ? {
            title: read('title') || undefined,
            borderColor: read('borderColor') || undefined,
            icon: icon === 'STAR' || icon === 'TAG' ? icon : undefined,
          }
        : {
            message: read('message') || undefined,
            mediaFit: mediaFit.find(({ value }) => value === read('mediaFit'))?.value,
            overlay: overlay.find(({ value }) => value === read('overlay'))?.value,
            ctaStyle: ctaStyle.find(({ value }) => value === read('ctaStyle'))?.value,
            ctaPath: read('ctaPath') || undefined,
            ctaLabel: read('ctaLabel') || undefined,
            showCountdown: read('showCountdown') === 'on',
          }),
    },
  } satisfies Pick<Appearance, 'textColor' | 'display'>;
}

export function CampaignPlacementStyleFields({ slot, saved }: { slot: Slot; saved?: Appearance }) {
  const display = saved?.display;
  const [useTheme, setUseTheme] = useState(display?.useTheme ?? false);
  const navigation = slot === 'NAVIGATION';
  const colors = [
    ['textColor', 'رنگ متن', saved?.textColor],
    ['backgroundColor', 'رنگ پس‌زمینه', display?.backgroundColor],
    ['gradientColor', 'رنگ دوم گرادیان', display?.gradientColor],
    ...(navigation ? [['borderColor', 'رنگ حاشیهٔ آیتم', display?.borderColor] as const] : []),
  ] as const;
  const textFields = navigation
    ? [['title', 'عنوان آیتم منو', display?.title, 64] as const]
    : ([
        ['message', 'متن نوار اعلان', display?.message, 180],
        ['ctaLabel', 'متن دکمهٔ اعلان', display?.ctaLabel, 64],
        ['ctaPath', 'مسیر دکمهٔ اعلان', display?.ctaPath, 220],
      ] as const);
  const options = navigation
    ? [['icon', 'آیکون آیتم منو', icons, display?.icon ?? 'DEFAULT'] as const]
    : ([
        ['mediaFit', 'چیدمان تصویر', mediaFit, display?.mediaFit ?? 'COVER'],
        ['overlay', 'پوشش روی تصویر', overlay, display?.overlay ?? 'NONE'],
        ['ctaStyle', 'ظاهر دکمهٔ اعلان', ctaStyle, display?.ctaStyle ?? 'LINK'],
      ] as const);

  return (
    <>
      {textFields.map(([key, label, value, maxLength]) => (
        <FormField
          key={key}
          id={`${slot}-${key}`}
          label={label}
          hint={key === 'ctaPath' ? 'یک مسیر فروشگاه مانند /products' : undefined}
        >
          {(control) => (
            <Input
              {...control}
              name={control.id}
              defaultValue={value ?? ''}
              maxLength={maxLength}
              dir={key === 'ctaPath' ? 'ltr' : undefined}
            />
          )}
        </FormField>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={`${slot}-useTheme`}
          checked={useTheme}
          onChange={(event) => setUseTheme(event.currentTarget.checked)}
        />
        استفاده از رنگ‌های تم لندینگ
      </label>
      {colors.map(([key, label, value]) => (
        <FormField key={key} id={`${slot}-${key}`} label={label}>
          {(control) => (
            <Input
              {...control}
              name={control.id}
              dir="ltr"
              placeholder="#161616"
              maxLength={7}
              pattern="#[0-9a-fA-F]{6}"
              defaultValue={value ?? ''}
              disabled={useTheme && key !== 'borderColor'}
            />
          )}
        </FormField>
      ))}
      <FormField id={`${slot}-motion`} label="شدت جلوهٔ حرکتی">
        {(control) => (
          <Select
            {...control}
            name={control.id}
            options={motion}
            defaultValue={display?.motion ?? 'DEFAULT'}
          />
        )}
      </FormField>
      {options.map(([key, label, choices, value]) => (
        <FormField key={key} id={`${slot}-${key}`} label={label}>
          {(control) => (
            <Select {...control} name={control.id} options={choices} defaultValue={value} />
          )}
        </FormField>
      ))}
      {!navigation && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={`${slot}-showCountdown`}
            defaultChecked={display?.showCountdown !== false}
          />
          نمایش شمارش معکوس تا پایان جشنواره
        </label>
      )}
    </>
  );
}
