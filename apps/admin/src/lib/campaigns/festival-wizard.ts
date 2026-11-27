export const festivalSteps = [
  { id: 'basics', label: 'اطلاعات و زمان‌بندی' },
  { id: 'products', label: 'محصولات و مجموعه' },
  { id: 'promotion', label: 'قوانین فروش و بودجه' },
  { id: 'theme', label: 'تم جشنواره' },
  { id: 'placements', label: 'منو و اعلان' },
  { id: 'landing', label: 'طراحی لندینگ' },
  { id: 'preview', label: 'پیش‌نمایش و بررسی' },
  { id: 'review', label: 'انتشار و مدیریت' },
] as const;

export type FestivalStep = (typeof festivalSteps)[number]['id'];

export function festivalStep(value: string | null | undefined): FestivalStep | undefined {
  return festivalSteps.find(({ id }) => id === value)?.id;
}

export function festivalStepHref(id: string, step: FestivalStep) {
  return `/campaigns?${new URLSearchParams({ id, step })}`;
}

export function suggestedFestivalSlug(name: string, suffix: string) {
  const words = name
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64 - suffix.length - 1)
    .replace(/-+$/g, '');
  return `${words || 'festival'}-${suffix}`;
}
