import { readCalendarValue } from '@/lib/presentation/dual-calendar';

export type CampaignFieldError = { field: string; message: string };
export const campaignIntMax = 2_147_483_647;

export function campaignDateError(start: string, end: string): CampaignFieldError | null {
  const from = readCalendarValue(start, 'date-time');
  const to = readCalendarValue(end, 'date-time');
  if (!from) return { field: 'startsTehran', message: 'زمان آغاز را انتخاب کنید.' };
  if (!to) return { field: 'endsTehran', message: 'زمان پایان را انتخاب کنید.' };
  if (from.day > to.day || (from.day === to.day && from.time >= to.time))
    return { field: 'endsTehran', message: 'زمان پایان باید پس از آغاز باشد.' };
  return null;
}

export function findCampaignField(form: HTMLFormElement, field: string) {
  return form.querySelector<HTMLElement>(
    `[data-calendar-field="${field}"], [data-campaign-field="${field}"], [name="${field}"]:not([type="hidden"])`,
  );
}

export function focusCampaignField(form: HTMLFormElement, field: string) {
  window.requestAnimationFrame(() => {
    const control = findCampaignField(form, field);
    const details = control?.closest('details');
    if (details) details.open = true;
    control?.focus();
  });
}
