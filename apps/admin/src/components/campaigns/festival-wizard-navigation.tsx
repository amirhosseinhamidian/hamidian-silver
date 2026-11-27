'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';

import { ButtonLink } from '@/components/ui/button';
import {
  festivalStep,
  festivalStepHref,
  festivalSteps,
  type FestivalStep,
} from '@/lib/campaigns/festival-wizard';
import { formatAdminInteger } from '@/lib/presentation/formatters';

function resumeKey(accountId: string, campaignId: string) {
  return `hamidian:festival-step:${accountId}:${campaignId}`;
}

export function FestivalDraftLink({
  accountId,
  id,
  name,
}: {
  accountId: string;
  id: string;
  name: string;
}) {
  const router = useRouter();
  const initial = festivalStepHref(id, 'basics');
  function resume(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      const saved = festivalStep(window.localStorage.getItem(resumeKey(accountId, id)));
      if (!saved || saved === 'basics') return;
      event.preventDefault();
      router.push(festivalStepHref(id, saved));
    } catch {
      // The link remains usable when browser storage is unavailable.
    }
  }

  return (
    <Link
      href={initial}
      onClick={resume}
      className="break-words font-semibold underline-offset-4 hover:underline"
    >
      {name}
    </Link>
  );
}

export function FestivalWizardNavigation({
  id,
  accountId,
  name,
  step,
  remember = false,
}: {
  id?: string;
  accountId: string;
  name: string;
  step: FestivalStep;
  remember?: boolean;
}) {
  const index = festivalSteps.findIndex(({ id: key }) => key === step);
  useEffect(() => {
    if (!id || !remember) return;
    try {
      window.localStorage.setItem(resumeKey(accountId, id), step);
    } catch {
      // A direct link still resumes the selected step.
    }
  }, [accountId, id, remember, step]);

  return (
    <div className="min-w-0 space-y-3">
      <nav aria-label="مسیر جشنواره" className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <Link href="/campaigns?view=festivals" className="underline">
          جشنواره‌های فروش
        </Link>
        <span aria-hidden="true">‹</span>
        <span className="break-words font-semibold" aria-current="page">
          {name}
        </span>
      </nav>
      <nav aria-label="مراحل جشنواره">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
          {festivalSteps.map(({ id: key, label }, position) => {
            const current = key === step;
            const content = (
              <>
                <span className="shrink-0 rounded bg-[var(--admin-color-surface-subtle)] px-1.5 py-0.5 font-semibold">
                  {formatAdminInteger(position + 1)}
                </span>
                <span className="min-w-0 break-words">{label}</span>
              </>
            );
            const classes = `flex h-full min-w-0 items-center gap-2 rounded-md border p-2 text-xs ${
              current
                ? 'border-[var(--admin-color-primary)] bg-[var(--admin-color-surface-hover)] font-bold'
                : 'border-[var(--admin-color-border)] bg-[var(--admin-color-surface)]'
            }`;
            return (
              <li key={key} className="min-w-0">
                {id ? (
                  <Link
                    className={`${classes} outline-none focus-visible:shadow-[var(--admin-focus-ring)]`}
                    href={festivalStepHref(id, key)}
                    aria-current={current ? 'step' : undefined}
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    className={classes}
                    aria-current={current ? 'step' : undefined}
                    aria-disabled={!current || undefined}
                  >
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {id && remember && index >= 0 && (
        <div className="flex flex-wrap gap-2">
          {index > 0 && (
            <ButtonLink
              size="sm"
              variant="outline"
              href={festivalStepHref(id, festivalSteps[index - 1].id)}
            >
              مرحلهٔ قبل
            </ButtonLink>
          )}
          {index < festivalSteps.length - 1 && (
            <ButtonLink
              size="sm"
              variant="outline"
              href={festivalStepHref(id, festivalSteps[index + 1].id)}
            >
              مرحلهٔ بعد
            </ButtonLink>
          )}
          <p className="w-full text-xs text-[var(--admin-color-muted)]">
            برای نگه داشتن تغییرات، همین مرحله را پیش از جابه‌جایی ذخیره کنید.
          </p>
        </div>
      )}
    </div>
  );
}
