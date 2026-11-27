'use client';

import type { components } from '@hamidian/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { FestivalThemeBrowser, type ThemeChoice } from './festival-theme-browser';
import {
  FestivalThemeFields,
  FestivalThemePreview,
  type FestivalTheme,
} from './festival-theme-fields';

type Template = components['schemas']['FestivalLibraryThemeDto'];
type Draft = { name: string; description: string; theme: FestivalTheme; expectedVersion?: number };
const emptyTheme: FestivalTheme = {
  background: '#f8f6f3',
  surface: '#ffffff',
  foreground: '#251c24',
  accent: '#67344a',
  decoration: 'NONE',
  motion: 'STILL',
};
const endpoint = '/api/festival-themes';

export function FestivalThemeLibrary({ canWrite }: { canWrite: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  function show(next: ThemeChoice) {
    if (busy) return;
    setChoice(next);
    setDraft(null);
    setNotice(null);
    panel.current?.scrollIntoView?.({ block: 'nearest' });
  }

  function edit(next: Draft) {
    setDraft(next);
    setNotice(null);
    panel.current?.scrollIntoView?.({ block: 'nearest' });
  }

  async function write(path: string, body: unknown, success: (row: Template) => string) {
    if (!canWrite || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await campaignError(response));
      const row = (await response.json()) as Template;
      setChoice({ ...row, templateVersion: row.version });
      setDraft(null);
      setRefresh((value) => value + 1);
      setNotice({ text: success(row) });
    } catch (failure) {
      setNotice({
        text: failure instanceof Error ? failure.message : 'ذخیرهٔ تم ممکن نشد.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setNotice({ text: 'برای تم یک نام وارد کنید.', error: true });
    void write(
      endpoint,
      { ...draft, name, description: draft.description.trim() || null },
      (row) => `نسخهٔ ${formatAdminInteger(row.version)} ذخیره شد.`,
    );
  }

  function archive() {
    if (!choice || !window.confirm(`تم «${choice.name}» برای انتخاب‌های جدید بایگانی شود؟`)) return;
    void write(
      `${endpoint}/archive`,
      { name: choice.name, expectedVersion: choice.templateVersion },
      () => 'تم بایگانی شد.',
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <Card
        title="تم‌های آماده و ذخیره‌شده"
        action={
          canWrite ? (
            <Button
              disabled={busy}
              onClick={() => edit({ name: '', description: '', theme: emptyTheme })}
            >
              ساخت تم
            </Button>
          ) : undefined
        }
      >
        <FestivalThemeBrowser key={refresh} manage onChoose={show} />
      </Card>
      <div ref={panel} className="min-w-0">
        <Card
          title={
            draft ? (draft.expectedVersion ? 'ساخت نسخهٔ جدید' : 'ذخیرهٔ تم مستقل') : 'جزئیات تم'
          }
        >
          <div className="space-y-3">
            {notice &&
              (notice.error ? (
                <Alert tone="danger">{notice.text}</Alert>
              ) : (
                <p role="status" className="text-sm">
                  {notice.text}
                </p>
              ))}
            {draft ? (
              <form className="space-y-3" onSubmit={save}>
                <fieldset className="space-y-3" disabled={busy}>
                  <label className="grid gap-1 text-sm">
                    نام تم
                    <Input
                      value={draft.name}
                      required
                      maxLength={80}
                      readOnly={draft.expectedVersion !== undefined}
                      onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    توضیحات
                    <Textarea
                      value={draft.description}
                      maxLength={240}
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.currentTarget.value })
                      }
                    />
                  </label>
                  <FestivalThemeFields
                    theme={draft.theme}
                    onChange={(theme) => setDraft({ ...draft, theme })}
                  />
                  <FestivalThemePreview theme={draft.theme} name={draft.name.trim() || 'تم جدید'} />
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={busy}>
                    {draft.expectedVersion ? 'ذخیرهٔ نسخهٔ جدید' : 'ذخیرهٔ تم'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setDraft(null);
                      setNotice(null);
                    }}
                  >
                    انصراف
                  </Button>
                </div>
              </form>
            ) : choice ? (
              <>
                <FestivalThemePreview theme={choice.theme} name={choice.name} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge>
                    {choice.preset ? 'تم آماده' : `نسخهٔ ${formatAdminInteger(choice.version)}`}
                  </Badge>
                  {choice.archivedAt && <Badge>بایگانی‌شده</Badge>}
                  {choice.updatedAt && <span>ویرایش {formatAdminDateTime(choice.updatedAt)}</span>}
                </div>
                {choice.description && (
                  <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {choice.description}
                  </p>
                )}
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        edit({
                          name: `نسخهٔ ${choice.name.slice(0, 69)}`,
                          description: choice.description ?? '',
                          theme: choice.theme,
                        })
                      }
                    >
                      تکثیر تم
                    </Button>
                    {!choice.preset && !choice.archivedAt && (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            edit({
                              name: choice.name,
                              description: choice.description ?? '',
                              theme: choice.theme,
                              expectedVersion: choice.templateVersion,
                            })
                          }
                        >
                          ساخت نسخهٔ جدید
                        </Button>
                        <Button variant="danger" disabled={busy} onClick={archive}>
                          بایگانی تم
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--admin-color-muted)]">
                یک تم را برای مشاهدهٔ پیش‌نمایش و نسخه‌ها انتخاب کنید.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
