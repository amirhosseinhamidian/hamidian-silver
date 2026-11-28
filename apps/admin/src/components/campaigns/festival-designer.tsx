'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { toAsciiDigits } from '@/lib/presentation/formatters';
import { FestivalSectionEditor } from './festival-section-editor';
import { FestivalThemeBrowser } from './festival-theme-browser';
import { FestivalThemeFields } from './festival-theme-fields';

type Editor = components['schemas']['FestivalDesignEditorDto'];
type Design = components['schemas']['FestivalDesignDto'];
type Section = components['schemas']['FestivalSectionDto'];
type Media = components['schemas']['CampaignMediaDto'];
type Kind = Section['kind'];
type Theme = Design['theme'];

const sectionLabels: Record<Kind, string> = {
  HERO: 'اسلایدهای آغاز صفحه',
  COUNTDOWN: 'زمان باقی‌مانده',
  INTRO: 'معرفی جشنواره',
  HIGHLIGHTS: 'مزیت‌های جشنواره',
  CATEGORIES: 'خرید بر اساس دسته',
  DISCOUNTS: 'تخفیف‌های بزرگ',
  PICKS: 'منتخب مدیر',
  LOW_QUOTA: 'نزدیک پایان سهمیه',
  BUDGET: 'خرید بر اساس بودجه',
  OFFERS: 'پیشنهادهای جشنواره',
  PRODUCTS: 'همهٔ محصولات',
  FAQ: 'سؤالات متداول',
};
function newSection(kind: Kind): Section {
  return { kind, title: sectionLabels[kind], enabled: true, layout: 'GRID' };
}
const defaults = (['HERO', 'COUNTDOWN', 'INTRO', 'PRODUCTS'] as const).map(newSection);
const supportedSections = Object.keys(sectionLabels) as Kind[];
const selectStyle = 'min-h-10 min-w-0 rounded-md border border-[var(--admin-color-border)] px-2';

export function initialFestivalDesign(editor: Editor): Design {
  return (
    editor.design ?? {
      schemaVersion: 1,
      theme: editor.presets[0].theme,
      themeSource: { name: editor.presets[0].name, version: 1 },
      sections: defaults,
    }
  );
}

export function FestivalDesigner({
  campaignId,
  editor,
  editable,
  onPreviewChange,
  view = 'all',
}: {
  campaignId: string;
  editor: Editor;
  editable: boolean;
  onPreviewChange?: (draft: Design | null) => void;
  view?: 'all' | 'theme' | 'sections';
}) {
  const router = useRouter();
  const showTheme = view !== 'sections';
  const showSections = view !== 'theme';
  const taxonomy = useCampaignTaxonomy(showSections);
  const [design, setDesign] = useState(() => initialFestivalDesign(editor));
  const [assets, setAssets] = useState<Readonly<Record<string, Media>>>(() =>
    Object.fromEntries(editor.media.map((asset) => [asset.id, asset])),
  );
  const [saveThemeAs, setSaveThemeAs] = useState('');
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [revisionToRestore, setRevisionToRestore] = useState('');
  const [sectionToAdd, setSectionToAdd] = useState<Kind | ''>('');
  const availableSections = supportedSections.filter(
    (kind) => !design.sections.some((section) => section.kind === kind),
  );
  const formRef = useRef<HTMLFormElement>(null);
  const endpoint = `/api/campaigns/${campaignId}/design`;

  useEffect(() => {
    onPreviewChange?.(uploads ? null : design);
  }, [design, onPreviewChange, uploads]);

  function setTheme(theme: Theme) {
    setDesign((current) => ({ ...current, theme }));
  }
  function setSection(next: Section) {
    setDesign((current) => ({
      ...current,
      sections: current.sections.map((row) => (row.kind === next.kind ? next : row)),
    }));
  }

  function addSection() {
    if (!sectionToAdd || !availableSections.includes(sectionToAdd)) return;
    const section = newSection(sectionToAdd);
    setDesign((current) => ({ ...current, sections: [...current.sections, section] }));
    setSectionToAdd('');
    setStatus(`بخش «${section.title}» اضافه شد.`);
  }

  function removeSection(section: Section) {
    if (section.kind === 'PRODUCTS' || uploads || busy) return;
    setDesign((current) => ({
      ...current,
      sections: current.sections.filter(({ kind }) => kind !== section.kind),
    }));
    setStatus(`بخش «${section.title}» از پیش‌نویس حذف شد.`);
  }
  function move(kind: Kind, target: Kind) {
    if (kind === target) return;
    const start = design.sections.findIndex((section) => section.kind === kind);
    const end = design.sections.findIndex((section) => section.kind === target);
    if (start < 0 || end < 0) return;
    const next = [...design.sections];
    next.splice(end, 0, next.splice(start, 1)[0]);
    setDesign((current) => ({ ...current, sections: next }));
    setStatus(
      `جایگاه ${sectionLabels[kind]} به ردیف ${(end + 1).toLocaleString('fa-IR')} تغییر کرد.`,
    );
  }

  async function request(path: string, method: 'POST' | 'PUT', body: unknown) {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await campaignError(response));
    return response;
  }

  function inputsValid() {
    if (busy || uploads || !formRef.current?.reportValidity()) return false;
    if (
      design.sections.some(
        ({ enabled, startsTehran, endsTehran }) =>
          enabled &&
          startsTehran &&
          endsTehran &&
          toAsciiDigits(startsTehran) >= toAsciiDigits(endsTehran),
      )
    ) {
      setError('زمان پایان هر سکشن باید پس از زمان آغاز آن باشد.');
      return false;
    }
    if (design.sections.some((section) => section.slides?.some(({ mediaId }) => !mediaId))) {
      setError('برای هر اسلاید، تصویر دسکتاپ را بارگذاری کنید.');
      return false;
    }
    return true;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || !inputsValid()) return;
    setBusy(true);
    setError(null);
    try {
      await request(endpoint, 'PUT', {
        ...design,
        expectedRevision: editor.revision,
        saveThemeAs: saveThemeAs.trim() || undefined,
      });
      router.refresh();
      setStatus('نسخهٔ طرح ذخیره شد.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ذخیرهٔ طرح انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!editable || busy || uploads || !revisionToRestore) return;
    setBusy(true);
    setError(null);
    try {
      await request(`${endpoint}/restore`, 'POST', {
        expectedRevision: editor.revision,
        revision: Number(revisionToRestore),
      });
      setStatus('نسخهٔ انتخاب‌شده به‌عنوان پیش‌نویس جدید ذخیره شد.');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'بازگردانی نسخه انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={view === 'theme' ? 'تم جشنواره' : 'طراحی صفحهٔ جشنواره'}>
      <form ref={formRef} className="space-y-5" onSubmit={(event) => void save(event)}>
        <fieldset disabled={!editable || busy || uploads > 0} className="space-y-4">
          {showTheme && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={themePickerOpen} onOpenChange={setThemePickerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">انتخاب تم از کتابخانه</Button>
                  </DialogTrigger>
                  <DialogContent
                    title="انتخاب تم جشنواره"
                    description="نسخهٔ انتخابی در پیش‌نویس این جشنواره کپی می‌شود."
                    size="lg"
                  >
                    <FestivalThemeBrowser
                      onChoose={({ name, version, theme }) => {
                        setDesign((current) => ({
                          ...current,
                          theme,
                          themeSource: { name, version },
                        }));
                        setThemePickerOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
                <ButtonLink
                  href="/campaigns/themes"
                  variant="ghost"
                  target="_blank"
                  rel="noreferrer"
                >
                  مدیریت کتابخانه
                </ButtonLink>
                {design.themeSource && (
                  <span className="text-xs [overflow-wrap:anywhere]">
                    الگوی پایهٔ {design.themeSource.name} · نسخهٔ{' '}
                    {design.themeSource.version.toLocaleString('fa-IR')}
                  </span>
                )}
              </div>
              <FestivalThemeFields theme={design.theme} onChange={setTheme} />
            </>
          )}

          {showSections && (
            <>
              {editable && availableSections.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-sm">
                    نوع بخش تازه
                    <Select
                      className={selectStyle}
                      value={sectionToAdd}
                      onValueChange={(value) => setSectionToAdd(value as Kind | '')}
                      aria-label="نوع بخش تازه"
                      options={[
                        { value: '', label: 'انتخاب نوع بخش' },
                        ...availableSections.map((kind) => ({
                          value: kind,
                          label: sectionLabels[kind],
                        })),
                      ]}
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={!sectionToAdd || busy || uploads > 0}
                    onClick={addSection}
                  >
                    افزودن بخش
                  </Button>
                </div>
              )}
              <ol aria-label="ترتیب بخش‌های جشنواره" className="space-y-3">
                {design.sections.map((section, index) => (
                  <li
                    key={section.kind}
                    onDragOver={
                      editable && !busy && !uploads ? (e) => e.preventDefault() : undefined
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      if (editable && !busy && !uploads)
                        move(e.dataTransfer.getData('text/plain') as Kind, section.kind);
                    }}
                    className="space-y-3 rounded-lg border border-[var(--admin-color-border)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          disabled={section.kind === 'PRODUCTS'}
                          checked={section.enabled}
                          onChange={(e) =>
                            setSection({ ...section, enabled: e.currentTarget.checked })
                          }
                        />
                        {sectionLabels[section.kind]}
                      </label>
                      {editable && (
                        <div className="flex items-center gap-1">
                          <span
                            draggable={!busy && !uploads}
                            aria-hidden="true"
                            className="cursor-grab px-2 text-lg"
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', section.kind)}
                          >
                            ⠿
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            aria-label={`بردن ${sectionLabels[section.kind]} به بالا`}
                            onClick={() => move(section.kind, design.sections[index - 1].kind)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === design.sections.length - 1}
                            aria-label={`بردن ${sectionLabels[section.kind]} به پایین`}
                            onClick={() => move(section.kind, design.sections[index + 1].kind)}
                          >
                            ↓
                          </Button>
                          {section.kind !== 'PRODUCTS' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy || uploads > 0}
                              aria-label={`حذف بخش ${sectionLabels[section.kind]}`}
                              onClick={() => removeSection(section)}
                            >
                              حذف بخش
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {section.enabled && (
                      <FestivalSectionEditor
                        section={section}
                        campaignId={campaignId}
                        taxonomy={taxonomy.data}
                        assets={assets}
                        update={setSection}
                        uploaded={(asset) =>
                          setAssets((current) => ({ ...current, [asset.id]: asset }))
                        }
                        onPendingChange={(pending) =>
                          setUploads((count) => (pending ? count + 1 : Math.max(0, count - 1)))
                        }
                      />
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          {showTheme && editable && (
            <label className="grid max-w-md gap-1 text-sm">
              ذخیرهٔ تم با نام جدید (اختیاری)
              <Input
                value={saveThemeAs}
                maxLength={80}
                onChange={(e) => setSaveThemeAs(e.currentTarget.value)}
              />
            </label>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button type="submit" disabled={uploads > 0} loading={busy}>
              ذخیرهٔ نسخهٔ طرح
            </Button>
          )}
        </div>
        {showSections && editable && editor.history.length > 1 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              نسخه برای بازگردانی
              <Select
                className={selectStyle}
                value={revisionToRestore}
                onValueChange={setRevisionToRestore}
                aria-label="نسخه برای بازگردانی"
                options={[
                  { value: '', label: 'انتخاب نسخه' },
                  ...editor.history.slice(1).map(({ revision, recordedAt }) => ({
                    value: String(revision),
                    label: `نسخهٔ ${revision.toLocaleString('fa-IR')} · ${new Date(recordedAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}`,
                  })),
                ]}
              />
            </label>
            <Button
              variant="outline"
              disabled={busy || uploads > 0 || !revisionToRestore}
              onClick={() => void restore()}
            >
              بازگردانی طرح
            </Button>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <p role="status" className="text-xs">
          {status}
        </p>
        <p className="text-xs">
          طرح با چرخهٔ تأیید و زمان‌بندی همین کمپین در فروشگاه منتشر می‌شود.
        </p>
      </form>
    </Card>
  );
}
