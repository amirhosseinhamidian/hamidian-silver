const messages: Record<string, string> = {
  'Enter an unambiguous Solar Hijri date and time in Tehran.':
    'تاریخ و ساعت شمسی را با الگوی فرم وارد کنید.',
  'The end time must follow the start time.': 'زمان پایان باید بعد از زمان آغاز باشد.',
  'The campaign end time has passed.': 'زمان پایان کمپین گذشته است.',
  'The collection has no sellable products.':
    'این مجموعه محصول قابل فروش ندارد. قواعد یا موجودی را بررسی کنید و دوباره پیش‌نمایش بگیرید.',
  'Another campaign uses this landing path in the same period.':
    'آدرس صفحه در این بازه به نوبت دیگری از کمپین اختصاص دارد.',
  'Banner times must be within the campaign window.':
    'آغاز و پایان هر جایگاه بنر باید در بازهٔ کمپین قرار بگیرد.',
  'The landing path is already assigned.': 'این اسلاگ به صفحهٔ دیگری اختصاص دارد.',
  'The saved landing path and SEO mode are fixed.': 'اسلاگ و نوع صفحه پس از ذخیره ثابت‌اند.',
  'Select published products within the campaign scope.':
    'محصولات فعال و داخل محدودهٔ کمپین را انتخاب کنید.',
  'Select a published banner target.': 'اسلاگ یک دسته یا محصول فعال را وارد کنید.',
  'A catalog attribute filter is not supported by the current definition.':
    'کد ویژگی، گزینه‌ها یا بازهٔ عددی را با تعریف فعلی ویژگی در کاتالوگ تطبیق دهید.',
  'Enter valid campaign tracking labels.': 'شناسه و نام ردیابی را بررسی کنید.',
  'Enter a valid campaign channel.': 'نام کانال را بررسی کنید.',
  'This campaign slug or tracking identifier is already in use.':
    'اسلاگ یا شناسهٔ ردیابی قبلاً استفاده شده است.',
  'This campaign identifier or name is already assigned to another campaign.':
    'شناسه و نام ردیابی با یک کمپین موجود مطابقت ندارد.',
  'Choose all products or select active products and categories.':
    'همهٔ محصولات یا محدوده‌ای از محصول‌ها و دسته‌ها را انتخاب کنید.',
  'Some products or categories in the campaign scope are unavailable.':
    'بعضی از محصول‌ها یا دسته‌های انتخابی پیدا نشدند یا غیرفعال‌اند.',
  'Choose an available campaign image.': 'تصویر کمپین در دسترس نیست. تصویری دیگر انتخاب کنید.',
  'Supply both the banner link and its label.': 'متن دکمه و مسیر مقصد را با هم وارد کنید.',
  'Choose a public storefront path.': 'یک مسیر عمومی فروشگاه مثل /products را وارد کنید.',
  'The encoded banner link is too long.': 'مسیر مقصد بنر بیش از حد طولانی است.',
  'The destination contains an unsupported or repeated parameter.':
    'پارامترهای مسیر مقصد را بررسی کنید.',
  'The destination already contains tracking parameters.':
    'پارامترهای ردیابی را از مسیر مقصد بردارید.',
  'The campaign changed. Reload it before submitting.': 'کمپین تغییر کرده است. صفحه را تازه کنید.',
  'Only draft campaigns can be edited.': 'ویرایش برای پیش‌نویس در دسترس است.',
  'This transition is unavailable for the current campaign status.':
    'این عملیات برای وضعیت فعلی کمپین در دسترس نیست.',
};

export async function campaignError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  const message = body?.error?.message;
  if (message && Object.hasOwn(messages, message)) return messages[message];
  if (response.status === 400) return 'مقادیر واردشده را بررسی کنید.';
  if (response.status === 409) return 'کمپین تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.';
  if (response.status === 401 || response.status === 403)
    return 'دسترسی انجام این عملیات را ندارید.';
  return 'ثبت عملیات ممکن نشد. دوباره تلاش کنید.';
}
