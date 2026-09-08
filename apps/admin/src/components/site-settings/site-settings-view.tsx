'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OrderedSiteSelection } from '@/components/site-settings/ordered-site-selection';
import { SiteMediaField } from '@/components/site-settings/site-media-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { formatAdminDateTime, formatAdminInteger, toAsciiDigits, toPersianDigits } from '@/lib/presentation/formatters';
import type { SiteSettingsData } from '@/lib/site-settings/site-settings-data';
import type {
  AdminHomepageSettings,
  AdminHomepageSlide,
  AdminSiteSettings,
  SiteAnnouncement,
  SiteMedia,
} from '@/lib/site-settings/site-settings-model';
import { cn } from '@/lib/ui/cn';

type Section = 'homepage' | 'header' | 'footer';
type EditableSlide = Omit<AdminHomepageSlide, 'mediaId' | 'media'> & {
  mediaId: string | null;
  media: SiteMedia | null;
};
type EditableHomepage = Omit<AdminHomepageSettings, 'primaryHeroSlides' | 'secondaryHero'> & {
  primaryHeroSlides: readonly EditableSlide[];
  secondaryHero: EditableSlide | null;
};

const SECTION_LABELS: Readonly<Record<Section, string>> = {
  homepage: 'صفحه اصلی و Hero',
  header: 'هدر و اعلان',
  footer: 'فوتر و تماس',
};

function errorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.';
}

async function requestJson(path: string, method: 'PATCH' | 'PUT', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(errorMessage(payload));
  return payload;
}

function editableHomepage(homepage: AdminHomepageSettings): EditableHomepage {
  return {
    ...homepage,
    primaryHeroSlides: homepage.primaryHeroSlides.map((slide) => ({ ...slide })),
    secondaryHero: homepage.secondaryHero ? { ...homepage.secondaryHero } : null,
  };
}

function blankSlide(kind: 'primary' | 'secondary'): EditableSlide {
  return {
    id: `draft-${kind}-${Date.now()}`,
    mediaId: null,
    media: null,
    title: null,
    subtitle: null,
    actionLabel: null,
    actionHref: null,
    sortOrder: 1,
    isActive: true,
  };
}

function catalogMedia(settings: AdminSiteSettings): SiteMedia | null {
  return settings.catalogHeroMediaId && settings.catalogHeroMedia
    ? {
        id: settings.catalogHeroMediaId,
        url: settings.catalogHeroMedia.url,
        mimeType: 'image/*',
        altText: settings.catalogHeroMedia.altText,
      }
    : null;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function HeroSlideEditor({
  slide,
  index,
  count,
  secondary = false,
  disabled,
  onChange,
  onMove,
  onRemove,
}: Readonly<{
  slide: EditableSlide;
  index: number;
  count: number;
  secondary?: boolean;
  disabled: boolean;
  onChange: (slide: EditableSlide) => void;
  onMove?: (offset: -1 | 1) => void;
  onRemove: () => void;
}>) {
  const title = secondary ? 'Hero دوم' : `اسلاید ${formatAdminInteger(index + 1)}`;
  const update = <Key extends keyof EditableSlide>(key: Key, value: EditableSlide[Key]) =>
    onChange({ ...slide, [key]: value });

  return (
    <Card
      title={title}
      description={secondary ? 'بنر اختیاری تک‌تصویری پایین صفحه اصلی' : 'در صورت وجود یک تصویر، Hero بدون کنترل اسلایدر نمایش داده می‌شود.'}
      action={
        <div className="flex gap-1">
          {!secondary ? (
            <>
              <Button aria-label={`انتقال ${title} به بالا`} variant="ghost" size="sm" disabled={disabled || index === 0} onClick={() => onMove?.(-1)}>↑</Button>
              <Button aria-label={`انتقال ${title} به پایین`} variant="ghost" size="sm" disabled={disabled || index === count - 1} onClick={() => onMove?.(1)}>↓</Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>حذف</Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <SiteMediaField
          label={title}
          media={slide.media}
          altText={slide.title ?? title}
          disabled={disabled}
          onUploaded={(media) => onChange({ ...slide, media, mediaId: media.id })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${slide.id}-title`} label="عنوان" hint="اختیاری">
            {(props) => <Input {...props} value={slide.title ?? ''} onChange={(event) => update('title', event.currentTarget.value || null)} placeholder="مثلاً درخشش نقره در هر لحظه" disabled={disabled} />}
          </FormField>
          <FormField id={`${slide.id}-action-label`} label="متن دکمه" hint="همراه لینک وارد شود">
            {(props) => <Input {...props} value={slide.actionLabel ?? ''} onChange={(event) => update('actionLabel', event.currentTarget.value || null)} placeholder="مثلاً مشاهده کالکشن" disabled={disabled} />}
          </FormField>
          <FormField id={`${slide.id}-subtitle`} label="زیرعنوان" hint="اختیاری" className="sm:col-span-2">
            {(props) => <Textarea {...props} value={slide.subtitle ?? ''} onChange={(event) => update('subtitle', event.currentTarget.value || null)} placeholder="توضیح کوتاه و لوکس برای این تصویر" disabled={disabled} />}
          </FormField>
          <FormField id={`${slide.id}-action-href`} label="لینک دکمه" hint="مسیر داخلی یا لینک کامل" className="sm:col-span-2">
            {(props) => <Input {...props} dir="ltr" value={slide.actionHref ?? ''} onChange={(event) => update('actionHref', event.currentTarget.value || null)} placeholder="/products یا https://example.com" disabled={disabled} />}
          </FormField>
          <Checkbox id={`${slide.id}-active`} label="نمایش این اسلاید" checked={slide.isActive} disabled={disabled} onChange={(event) => update('isActive', event.currentTarget.checked)} />
        </div>
      </div>
    </Card>
  );
}

function HomepageSection({
  settings,
  homepage,
  data,
  canWrite,
  pending,
  setSettings,
  setHomepage,
  onSaveSettings,
  onSaveHomepage,
}: Readonly<{
  settings: AdminSiteSettings;
  homepage: EditableHomepage;
  data: SiteSettingsData;
  canWrite: boolean;
  pending: string | null;
  setSettings: (settings: AdminSiteSettings) => void;
  setHomepage: (homepage: EditableHomepage) => void;
  onSaveSettings: () => void;
  onSaveHomepage: () => void;
}>) {
  function updateSlide(index: number, slide: EditableSlide) {
    setHomepage({
      ...homepage,
      primaryHeroSlides: homepage.primaryHeroSlides.map((candidate, candidateIndex) => candidateIndex === index ? slide : candidate),
    });
  }
  function moveSlide(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= homepage.primaryHeroSlides.length) return;
    const slides = [...homepage.primaryHeroSlides];
    [slides[index], slides[target]] = [slides[target]!, slides[index]!];
    setHomepage({ ...homepage, primaryHeroSlides: slides });
  }

  return (
    <div className="space-y-5">
      <Card
        title="Hero اصلی صفحه خانه"
        description="حداکثر ۱۰ اسلاید؛ عنوان، زیرعنوان و اکشن اختیاری هستند."
        action={<Button disabled={!canWrite || pending !== null || homepage.primaryHeroSlides.length >= 10} onClick={() => setHomepage({ ...homepage, primaryHeroSlides: [...homepage.primaryHeroSlides, blankSlide('primary')] })}>افزودن اسلاید</Button>}
      >
        <div className="space-y-4">
          {homepage.primaryHeroSlides.length ? homepage.primaryHeroSlides.map((slide, index) => (
            <HeroSlideEditor
              key={slide.id}
              slide={slide}
              index={index}
              count={homepage.primaryHeroSlides.length}
              disabled={!canWrite || pending !== null}
              onChange={(next) => updateSlide(index, next)}
              onMove={(offset) => moveSlide(index, offset)}
              onRemove={() => setHomepage({ ...homepage, primaryHeroSlides: homepage.primaryHeroSlides.filter((_, candidateIndex) => candidateIndex !== index) })}
            />
          )) : <Alert tone="warning">Hero اصلی تصویری ندارد و در صفحه خانه نمایش داده نمی‌شود.</Alert>}
        </div>
      </Card>

      {homepage.secondaryHero ? (
        <HeroSlideEditor
          slide={homepage.secondaryHero}
          index={0}
          count={1}
          secondary
          disabled={!canWrite || pending !== null}
          onChange={(secondaryHero) => setHomepage({ ...homepage, secondaryHero })}
          onRemove={() => setHomepage({ ...homepage, secondaryHero: null })}
        />
      ) : (
        <Card title="Hero دوم" description="بنر تک‌تصویری اختیاری بعد از بخش برندها">
          <Button variant="outline" disabled={!canWrite || pending !== null} onClick={() => setHomepage({ ...homepage, secondaryHero: blankSlide('secondary') })}>فعال‌کردن Hero دوم</Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderedSiteSelection label="دسته‌های منتخب صفحه اصلی" description="چهار دسته به‌ترتیب اولویت؛ دو مورد بالا و دو مورد پایین Hero دوم نمایش داده می‌شوند." options={data.categories} selectedIds={homepage.categoryIds} max={4} disabled={!canWrite || pending !== null} onChange={(categoryIds) => setHomepage({ ...homepage, categoryIds })} />
        <OrderedSiteSelection label="محصولات محبوب" description="تا هشت محصول فعال برای سکشن محبوب‌ترین محصولات." options={data.products} selectedIds={homepage.popularProductIds} max={8} disabled={!canWrite || pending !== null} onChange={(popularProductIds) => setHomepage({ ...homepage, popularProductIds })} />
      </div>

      <div className="flex justify-end"><Button loading={pending === 'homepage'} disabled={!canWrite || pending !== null} onClick={onSaveHomepage}>ذخیره تنظیمات صفحه اصلی</Button></div>

      <Card title="Hero صفحه فهرست محصولات" description="بنر اختیاری مستقل در ابتدای صفحه محصولات">
        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <SiteMediaField
            label="Hero محصولات"
            media={catalogMedia(settings)}
            altText={settings.catalogHeroTitle ?? 'محصولات نقره حمیدیان'}
            disabled={!canWrite || pending !== null}
            onUploaded={(media) => setSettings({ ...settings, catalogHeroMediaId: media.id, catalogHeroMedia: { url: media.url, altText: media.altText } })}
            onClear={() => setSettings({ ...settings, catalogHeroEnabled: false, catalogHeroMediaId: null, catalogHeroMedia: null })}
          />
          <div className="space-y-4">
            <Checkbox id="catalog-hero-enabled" label="نمایش Hero محصولات" checked={settings.catalogHeroEnabled} disabled={!canWrite || pending !== null} onChange={(event) => setSettings({ ...settings, catalogHeroEnabled: event.currentTarget.checked })} />
            <FormField id="catalog-hero-title" label="عنوان Hero">
              {(props) => <Input {...props} value={settings.catalogHeroTitle ?? ''} onChange={(event) => setSettings({ ...settings, catalogHeroTitle: event.currentTarget.value || null })} placeholder="مثلاً مجموعه محصولات نقره" disabled={!canWrite || pending !== null} />}
            </FormField>
            <FormField id="catalog-hero-subtitle" label="زیرعنوان Hero">
              {(props) => <Textarea {...props} value={settings.catalogHeroSubtitle ?? ''} onChange={(event) => setSettings({ ...settings, catalogHeroSubtitle: event.currentTarget.value || null })} placeholder="متن کوتاه معرفی کالکشن" disabled={!canWrite || pending !== null} />}
            </FormField>
            <Button loading={pending === 'settings'} disabled={!canWrite || pending !== null} onClick={onSaveSettings}>ذخیره Hero محصولات</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function HeaderSection({ settings, categories, canWrite, pending, onChange, onSave }: Readonly<{
  settings: AdminSiteSettings;
  categories: SiteSettingsData['categories'];
  canWrite: boolean;
  pending: string | null;
  onChange: (settings: AdminSiteSettings) => void;
  onSave: () => void;
}>) {
  const announcement = settings.announcement;
  const updateAnnouncement = (patch: Partial<SiteAnnouncement>) => onChange({ ...settings, announcement: { ...announcement, ...patch } });
  const minutes = announcement.durationSeconds === null ? '' : toPersianDigits(Math.round(announcement.durationSeconds / 60));

  return (
    <div className="space-y-5">
      <Card title="دسته‌های هدر" description="دسته‌های اصلی را با ترتیب دلخواه در هدر دسکتاپ و منوی موبایل نمایش دهید.">
        <OrderedSiteSelection label="پیمایش دسته‌بندی‌ها" description="حداکثر هشت دسته فعال؛ ترتیب این فهرست در هدر حفظ می‌شود." options={categories} selectedIds={settings.headerCategoryIds} max={8} disabled={!canWrite || pending !== null} onChange={(headerCategoryIds) => onChange({ ...settings, headerCategoryIds })} />
      </Card>

      <Card title="نوار اعلان" description="پیام بالای سایت با اکشن و شمارش معکوس اختیاری">
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox id="announcement-enabled" label="نمایش نوار اعلان" checked={announcement.enabled} disabled={!canWrite || pending !== null} onChange={(event) => updateAnnouncement({ enabled: event.currentTarget.checked })} />
          <FormField id="announcement-mode" label="نوع شمارش معکوس">
            {(props) => <Select {...props} value={announcement.countdownMode} disabled={!canWrite || pending !== null} onValueChange={(value) => updateAnnouncement({ countdownMode: value as SiteAnnouncement['countdownMode'] })} options={[{ value: 'NONE', label: 'بدون شمارش' }, { value: 'FIXED', label: 'مدت ثابت برای هر بازدید' }, { value: 'DEADLINE', label: 'تا تاریخ مشخص' }]} />}
          </FormField>
          <FormField id="announcement-message" label="متن اعلان" required className="sm:col-span-2">
            {(props) => <Input {...props} value={announcement.message ?? ''} onChange={(event) => updateAnnouncement({ message: event.currentTarget.value || null })} placeholder="مثلاً ارسال رایگان برای سفارش‌های بالای سه میلیون تومان" disabled={!canWrite || pending !== null} />}
          </FormField>
          {announcement.countdownMode === 'FIXED' ? (
            <FormField id="announcement-duration" label="مدت شمارش" hint="دقیقه؛ بین ۱ تا ۱۰٬۰۸۰">
              {(props) => <Input {...props} inputMode="numeric" value={minutes} onChange={(event) => { const value = Number(toAsciiDigits(event.currentTarget.value)); updateAnnouncement({ durationSeconds: Number.isFinite(value) && value > 0 ? Math.round(value * 60) : null }); }} placeholder="مثلاً ۹۰" disabled={!canWrite || pending !== null} />}
            </FormField>
          ) : null}
          {announcement.countdownMode === 'DEADLINE' ? (
            <FormField id="announcement-deadline" label="پایان شمارش">
              {(props) => <Input {...props} type="datetime-local" value={toDateTimeLocal(announcement.endsAt)} onChange={(event) => updateAnnouncement({ endsAt: event.currentTarget.value ? new Date(event.currentTarget.value).toISOString() : null })} disabled={!canWrite || pending !== null} />}
            </FormField>
          ) : null}
          <FormField id="announcement-cta-label" label="متن اکشن" hint="اختیاری؛ همراه لینک">
            {(props) => <Input {...props} value={announcement.ctaLabel ?? ''} onChange={(event) => updateAnnouncement({ ctaLabel: event.currentTarget.value || null })} placeholder="مثلاً مشاهده محصولات" disabled={!canWrite || pending !== null} />}
          </FormField>
          <FormField id="announcement-cta-href" label="لینک اکشن" hint="مسیر داخلی یا URL کامل">
            {(props) => <Input {...props} dir="ltr" value={announcement.ctaHref ?? ''} onChange={(event) => updateAnnouncement({ ctaHref: event.currentTarget.value || null })} placeholder="/products" disabled={!canWrite || pending !== null} />}
          </FormField>
        </div>
      </Card>
      <div className="flex justify-end"><Button loading={pending === 'settings'} disabled={!canWrite || pending !== null} onClick={onSave}>ذخیره هدر و اعلان</Button></div>
    </div>
  );
}

function FooterSection({ settings, canWrite, pending, onChange, onSave }: Readonly<{
  settings: AdminSiteSettings;
  canWrite: boolean;
  pending: string | null;
  onChange: (settings: AdminSiteSettings) => void;
  onSave: () => void;
}>) {
  const disabled = !canWrite || pending !== null;
  return (
    <div className="space-y-5">
      <Card title="معرفی گالری" description="نام و متن کوتاه ستون معرفی فوتر">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="gallery-name" label="نام گالری">
            {(props) => <Input {...props} value={settings.galleryName ?? ''} onChange={(event) => onChange({ ...settings, galleryName: event.currentTarget.value || null })} placeholder="مثلاً گالری نقره حمیدیان" disabled={disabled} />}
          </FormField>
          <FormField id="footer-about" label="متن درباره گالری" className="sm:col-span-2">
            {(props) => <Textarea {...props} value={settings.footerAbout ?? ''} onChange={(event) => onChange({ ...settings, footerAbout: event.currentTarget.value || null })} placeholder="معرفی کوتاه مجموعه، سابقه و ارزش پیشنهادی" disabled={disabled} />}
          </FormField>
        </div>
      </Card>
      <Card title="اطلاعات تماس" description="در فوتر و صفحه تماس با لینک‌های قابل اقدام نمایش داده می‌شود.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="contact-address" label="نشانی" className="sm:col-span-2">
            {(props) => <Textarea {...props} value={settings.contactAddress ?? ''} onChange={(event) => onChange({ ...settings, contactAddress: event.currentTarget.value || null })} placeholder="استان، شهر، خیابان، پلاک و واحد" disabled={disabled} />}
          </FormField>
          <FormField id="contact-phones" label="شماره‌های تماس" hint="هر شماره در یک خط؛ حداکثر پنج شماره">
            {(props) => <Textarea {...props} dir="ltr" value={settings.contactPhoneNumbers.join('\n')} onChange={(event) => onChange({ ...settings, contactPhoneNumbers: event.currentTarget.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 5) })} placeholder={'02112345678\n09121234567'} disabled={disabled} />}
          </FormField>
          <FormField id="contact-email" label="ایمیل">
            {(props) => <Input {...props} dir="ltr" type="email" value={settings.contactEmail ?? ''} onChange={(event) => onChange({ ...settings, contactEmail: event.currentTarget.value || null })} placeholder="hello@example.com" disabled={disabled} />}
          </FormField>
        </div>
      </Card>
      <Card title="شبکه‌های اجتماعی" description="لینک کامل صفحه رسمی را وارد کنید.">
        <div className="grid gap-4 sm:grid-cols-3">
          {([
            ['instagramUrl', 'اینستاگرام', 'https://instagram.com/...'],
            ['telegramUrl', 'تلگرام', 'https://t.me/...'],
            ['baleUrl', 'بله', 'https://ble.ir/...'],
          ] as const).map(([key, label, placeholder]) => (
            <FormField key={key} id={key} label={label}>
              {(props) => <Input {...props} dir="ltr" value={settings[key] ?? ''} onChange={(event) => onChange({ ...settings, [key]: event.currentTarget.value || null })} placeholder={placeholder} disabled={disabled} />}
            </FormField>
          ))}
        </div>
      </Card>
      <div className="flex justify-end"><Button loading={pending === 'settings'} disabled={disabled} onClick={onSave}>ذخیره فوتر و تماس</Button></div>
    </div>
  );
}

export function SiteSettingsView({ data, canWrite }: Readonly<{ data: SiteSettingsData; canWrite: boolean }>) {
  const router = useRouter();
  const [section, setSection] = useState<Section>('homepage');
  const [settings, setSettings] = useState(data.settings);
  const [homepage, setHomepage] = useState(data.homepage ? editableHomepage(data.homepage) : null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!settings || !homepage) {
    return <Alert tone="danger" title="دریافت تنظیمات ناموفق بود">اطلاعات تنظیمات سایت یا صفحه اصلی کامل دریافت نشد. اتصال API و دسترسی settings.read را بررسی کنید.</Alert>;
  }

  async function saveSettings() {
    const currentSettings = settings;
    if (!currentSettings) {
      setError('اطلاعات تنظیمات عمومی برای ذخیره در دسترس نیست.');
      return;
    }
    if (currentSettings.catalogHeroEnabled && !currentSettings.catalogHeroMediaId) {
      setError('برای فعال‌کردن Hero محصولات ابتدا تصویر انتخاب کنید.');
      return;
    }
    setPending('settings');
    setError(null);
    setSuccess(null);
    try {
      await requestJson('/api/site-settings', 'PATCH', {
        headerCategoryIds: currentSettings.headerCategoryIds,
        announcement: currentSettings.announcement,
        catalogHeroEnabled: currentSettings.catalogHeroEnabled,
        catalogHeroTitle: currentSettings.catalogHeroTitle,
        catalogHeroSubtitle: currentSettings.catalogHeroSubtitle,
        catalogHeroMediaId: currentSettings.catalogHeroMediaId,
        galleryName: currentSettings.galleryName,
        footerAbout: currentSettings.footerAbout,
        contactAddress: currentSettings.contactAddress,
        contactPhoneNumbers: currentSettings.contactPhoneNumbers,
        contactEmail: currentSettings.contactEmail,
        instagramUrl: currentSettings.instagramUrl,
        telegramUrl: currentSettings.telegramUrl,
        baleUrl: currentSettings.baleUrl,
      });
      setSuccess('تنظیمات عمومی سایت ذخیره شد.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : errorMessage(null));
    } finally {
      setPending(null);
    }
  }

  async function saveHomepage() {
    const currentHomepage = homepage;
    if (!currentHomepage) {
      setError('اطلاعات صفحه اصلی برای ذخیره در دسترس نیست.');
      return;
    }
    const slides = [...currentHomepage.primaryHeroSlides, ...(currentHomepage.secondaryHero ? [currentHomepage.secondaryHero] : [])];
    if (slides.some((slide) => !slide.mediaId)) {
      setError('برای تمام Heroهای اضافه‌شده باید تصویر انتخاب شود.');
      return;
    }
    if (slides.some((slide) => Boolean(slide.actionLabel?.trim()) !== Boolean(slide.actionHref?.trim()))) {
      setError('متن و لینک اکشن هر Hero باید با هم تکمیل شوند.');
      return;
    }
    setPending('homepage');
    setError(null);
    setSuccess(null);
    const project = (slide: EditableSlide) => ({
      mediaId: slide.mediaId!,
      title: slide.title?.trim() || null,
      subtitle: slide.subtitle?.trim() || null,
      actionLabel: slide.actionLabel?.trim() || null,
      actionHref: slide.actionHref?.trim() || null,
      isActive: slide.isActive,
    });
    try {
      await requestJson('/api/site-settings/homepage', 'PUT', {
        primaryHeroSlides: currentHomepage.primaryHeroSlides.map(project),
        secondaryHero: currentHomepage.secondaryHero ? project(currentHomepage.secondaryHero) : null,
        categoryIds: currentHomepage.categoryIds,
        popularProductIds: currentHomepage.popularProductIds,
      });
      setSuccess('تنظیمات صفحه اصلی ذخیره شد.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : errorMessage(null));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      {!canWrite ? <Alert tone="warning">دسترسی شما فقط‌خواندنی است؛ برای ذخیره تغییرات permission ‌settings.write لازم است.</Alert> : null}
      {data.failed ? <Alert tone="warning">برخی گزینه‌های مرجع دریافت نشدند؛ قبل از ذخیره دسته یا محصول، اتصال API را بررسی کنید.</Alert> : null}
      {error ? <Alert tone="danger" title="ذخیره ناموفق بود">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div role="tablist" aria-label="بخش‌های تنظیمات سایت" className="flex max-w-full overflow-x-auto border-b border-[var(--admin-color-border)]">
        {(Object.keys(SECTION_LABELS) as Section[]).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={section === item} aria-controls={`site-settings-panel-${item}`} onClick={() => setSection(item)} className={cn('min-w-max border-b-2 px-4 py-3 text-sm font-bold transition-colors', section === item ? 'border-[var(--admin-color-primary)] text-[var(--admin-color-primary)]' : 'border-transparent text-[var(--admin-color-muted)] hover:text-[var(--admin-color-ink)]')}>{SECTION_LABELS[item]}</button>
        ))}
      </div>

      <section id={`site-settings-panel-${section}`} role="tabpanel" className="outline-none">
        {section === 'homepage' ? <HomepageSection settings={settings} homepage={homepage} data={data} canWrite={canWrite} pending={pending} setSettings={setSettings} setHomepage={setHomepage} onSaveSettings={() => void saveSettings()} onSaveHomepage={() => void saveHomepage()} /> : null}
        {section === 'header' ? <HeaderSection settings={settings} categories={data.categories} canWrite={canWrite} pending={pending} onChange={setSettings} onSave={() => void saveSettings()} /> : null}
        {section === 'footer' ? <FooterSection settings={settings} canWrite={canWrite} pending={pending} onChange={setSettings} onSave={() => void saveSettings()} /> : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-color-border)] pt-4 text-xs text-[var(--admin-color-subtle)]">
        <span>تغییرات پس از ذخیره در درخواست بعدی Storefront اعمال می‌شوند.</span>
        <span>آخرین تغییر: {settings.updatedAt ? formatAdminDateTime(settings.updatedAt) : 'ثبت نشده'}</span>
      </div>
    </div>
  );
}
