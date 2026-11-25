'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { toAsciiDigits } from '@/lib/presentation/formatters';
import { FestivalSectionEditor } from './festival-section-editor';

type Editor = components['schemas']['FestivalDesignEditorDto'];
type Design = components['schemas']['FestivalDesignDto'];
type Section = components['schemas']['FestivalSectionDto'];
type Media = components['schemas']['CampaignMediaDto'];
type Kind = Section['kind'];
type Theme = Design['theme'];

const sectionLabels: Record<Kind, string> = {
  HERO: 'اسلایدهای آغاز صفحه',
  COUNTDOWN: 'زمان باقی‌مانده',
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
const defaults = (Object.keys(sectionLabels) as Kind[]).map((kind) => ({
  kind,
  title: sectionLabels[kind],
  enabled: ['HERO', 'COUNTDOWN', 'PRODUCTS'].includes(kind),
  layout: 'GRID' as const,
}));
const colorFields = [
  ['background', 'پس‌زمینه'],
  ['surface', 'سطح کارت‌ها'],
  ['foreground', 'متن'],
  ['accent', 'رنگ تأکید'],
  ['gradient', 'رنگ آغاز گرادیان'],
] as const;
const selectStyle = 'min-h-10 min-w-0 rounded-md border border-[var(--admin-color-border)] px-2';

function openFestivalPreview(device: 'mobile' | 'desktop', onError: (message: string) => void) {
  const storefront = new URL(
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://hamidian.shop'),
  );
  const preview = new URL('/campaign-preview', storefront);
  preview.searchParams.set('device', device);
  const nonce = crypto.randomUUID();
  preview.hash = new URLSearchParams({ nonce, admin: window.location.origin }).toString();
  const popup = window.open(preview.href, '_blank', 'popup,width=1280,height=900');
  if (!popup) throw new Error('preview blocked');
  let ready = false;
  let payload: components['schemas']['FestivalPreviewDto'] | null = null;

  function deliver() {
    if (!ready || !payload) return;
    popup?.postMessage({ kind: 'festival-preview', nonce, payload }, storefront.origin);
    cleanup();
  }

  function receive(event: MessageEvent) {
    if (
      event.origin !== storefront.origin ||
      event.source !== popup ||
      event.data?.kind !== 'festival-preview-ready' ||
      event.data?.nonce !== nonce
    )
      return;
    ready = true;
    deliver();
  }

  const timer = window.setTimeout(() => {
    cleanup();
    onError('پیش‌نمایش به فروشگاه وصل نشد. نشانی فروشگاه و مجوز پنجرهٔ جدید را بررسی کنید.');
  }, 45_000);
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener('message', receive);
  }

  window.addEventListener('message', receive);
  return {
    send(data: components['schemas']['FestivalPreviewDto']) {
      payload = data;
      deliver();
    },
    cleanup,
    close() {
      cleanup();
      popup.close();
    },
  };
}

export function FestivalDesigner({
  campaignId,
  editor,
  editable,
}: {
  campaignId: string;
  editor: Editor;
  editable: boolean;
}) {
  const router = useRouter();
  const taxonomy = useCampaignTaxonomy();
  const [design, setDesign] = useState<Design>(
    () =>
      editor.design ?? {
        schemaVersion: 1,
        theme: editor.presets[0].theme,
        sections: defaults,
      },
  );
  const [assets, setAssets] = useState<Readonly<Record<string, Media>>>(() =>
    Object.fromEntries(editor.media.map((asset) => [asset.id, asset])),
  );
  const [saveThemeAs, setSaveThemeAs] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [revisionToRestore, setRevisionToRestore] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const cancelPreview = useRef<(() => void) | null>(null);
  const endpoint = `/api/campaigns/${campaignId}/design`;

  useEffect(() => () => cancelPreview.current?.(), []);

  function setTheme(theme: Theme) {
    setDesign((current) => ({ ...current, theme }));
  }
  function setSection(next: Section) {
    setDesign((current) => ({
      ...current,
      sections: current.sections.map((row) => (row.kind === next.kind ? next : row)),
    }));
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

  async function preview(device: 'mobile' | 'desktop') {
    if (!inputsValid()) return;
    setError(null);
    let viewer: ReturnType<typeof openFestivalPreview>;
    try {
      cancelPreview.current?.();
      viewer = openFestivalPreview(device, setError);
      cancelPreview.current = viewer.cleanup;
    } catch {
      setError('اجازهٔ باز شدن پنجرهٔ پیش‌نمایش را در مرورگر فعال کنید.');
      return;
    }
    setBusy(true);
    try {
      const response = await request(`${endpoint}/preview`, 'POST', design);
      viewer.send((await response.json()) as components['schemas']['FestivalPreviewDto']);
    } catch (failure) {
      viewer.close();
      setError(failure instanceof Error ? failure.message : 'دریافت پیش‌نمایش انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="طراحی صفحهٔ جشنواره">
      <form ref={formRef} className="space-y-5" onSubmit={(event) => void save(event)}>
        <fieldset disabled={!editable || busy || uploads > 0} className="space-y-4">
          <label className="grid max-w-md gap-1 text-sm">
            الگوی تم
            <select
              className={selectStyle}
              value=""
              onChange={(e) => {
                const selected = editor.presets.find(({ name }) => name === e.currentTarget.value);
                if (selected) setTheme(selected.theme);
              }}
            >
              <option value="" disabled>
                انتخاب الگو
              </option>
              {editor.presets.map(({ name }) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {colorFields.map(([key, label]) => (
              <label key={key} className="grid gap-1 text-sm">
                {label}
                <Input
                  type="color"
                  value={design.theme[key] ?? design.theme.background}
                  onChange={(e) => setTheme({ ...design.theme, [key]: e.currentTarget.value })}
                />
              </label>
            ))}
            <label className="grid gap-1 text-sm">
              نقش پس‌زمینه
              <select
                className={selectStyle}
                value={design.theme.decoration}
                onChange={(e) =>
                  setTheme({
                    ...design.theme,
                    decoration: e.currentTarget.value as Theme['decoration'],
                  })
                }
              >
                <option value="NONE">ساده</option>
                <option value="DOTS">نقطه‌ای</option>
                <option value="LINES">خطی</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              حرکت اسلایدها
              <select
                className={selectStyle}
                value={design.theme.motion}
                onChange={(e) =>
                  setTheme({
                    ...design.theme,
                    motion: e.currentTarget.value as Theme['motion'],
                  })
                }
              >
                <option value="STILL">با کنترل دستی</option>
                <option value="SOFT">چرخش خودکار</option>
              </select>
            </label>
          </div>

          <ol aria-label="ترتیب بخش‌های جشنواره" className="space-y-3">
            {design.sections.map((section, index) => (
              <li
                key={section.kind}
                onDragOver={editable && !busy && !uploads ? (e) => e.preventDefault() : undefined}
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
                      onChange={(e) => setSection({ ...section, enabled: e.currentTarget.checked })}
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

          {editable && (
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
          <Button
            variant="outline"
            disabled={busy || uploads > 0}
            onClick={() => void preview('desktop')}
          >
            پیش‌نمایش دسکتاپ
          </Button>
          <Button
            variant="outline"
            disabled={busy || uploads > 0}
            onClick={() => void preview('mobile')}
          >
            پیش‌نمایش موبایل
          </Button>
        </div>
        {editable && editor.history.length > 1 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              نسخه برای بازگردانی
              <select
                className={selectStyle}
                value={revisionToRestore}
                onChange={(e) => setRevisionToRestore(e.currentTarget.value)}
              >
                <option value="">انتخاب نسخه</option>
                {editor.history.slice(1).map(({ revision, recordedAt }) => (
                  <option key={revision} value={revision}>
                    نسخهٔ {revision.toLocaleString('fa-IR')} ·{' '}
                    {new Date(recordedAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}
                  </option>
                ))}
              </select>
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
