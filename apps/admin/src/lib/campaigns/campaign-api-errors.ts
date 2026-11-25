const messages: Record<string, string> = {
  'Enter a valid festival theme name.': 'نام معتبر برای تم وارد کنید.',
  'Enter a valid festival theme description.': 'توضیحات تم دارای نویسهٔ نامعتبر است.',
  'This archived theme cannot be selected for a new design.':
    'این تم بایگانی شده است. تم دیگری از کتابخانه انتخاب کنید.',
  'Choose a name different from the built-in themes.':
    'برای تم مستقل، نامی غیر از تم‌های آماده انتخاب کنید.',
  'That theme name is already in use.': 'این نام تم قبلاً استفاده شده است.',
  'The festival theme has changed or was archived.':
    'تم تغییر کرده یا بایگانی شده است. فهرست را تازه کنید و دوباره نسخهٔ موردنظر را باز کنید.',
  'Festival theme version was not found.': 'نسخهٔ انتخاب‌شدهٔ تم پیدا نشد.',
  'Enter an unambiguous Solar Hijri date and time in Tehran.':
    'تاریخ و ساعت شمسی را با الگوی فرم وارد کنید.',
  'The end time must follow the start time.': 'زمان پایان باید بعد از زمان آغاز باشد.',
  'The campaign end time has passed.': 'زمان پایان کمپین گذشته است.',
  'The festival start time has not arrived.': 'زمان آغاز جشنواره هنوز نرسیده است.',
  'A festival needs a landing before publication.': 'پیش از انتشار، لندینگ جشنواره را ذخیره کنید.',
  'Archiving is unavailable until the festival ends.': 'جشنواره پس از پایان قابل بایگانی است.',
  'Marketing campaigns do not have a landing.':
    'تنظیمات لندینگ برای جشنواره‌های فروش در دسترس است.',
  'Only a legacy draft can be classified as a festival.':
    'فقط پیش‌نویس کمپین‌های قبلی قابل تبدیل به جشنواره است.',
  'This action is only available for sales festivals.':
    'این عملیات برای جشنوارهٔ فروش در دسترس است.',
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
  'The planned channel cost exceeds the campaign budget.':
    'هزینهٔ برنامه‌ریزی‌شدهٔ کانال از کل بودجهٔ کمپین بیشتر است.',
  'The discount budget is below existing commitments.':
    'سقف تخفیف از تخفیف‌های تعهدشدهٔ سفارش‌های قبلی کمتر است.',
  'No discount budget remains for this campaign.':
    'بودجه‌ای برای تخفیف نمانده است. سقف کمپین یا هزینهٔ کانال را بررسی کنید.',
  'The promotion has reached its redemption limit.': 'سقف تعداد استفاده از این قانون پر شده است.',
  'Configure a promotion for the selected audience.':
    'برای گروه مخاطب انتخاب‌شده، ابتدا قانون تخفیف را ذخیره کنید.',
  'Choose active bundle products in the campaign scope.':
    'محصولات فعال بسته را از محدودهٔ همین کمپین انتخاب کنید.',
  'The remaining budget can reduce the discount below its per-order cap.':
    'بودجهٔ باقی‌مانده ممکن است تخفیف را از سقف تعیین‌شده برای هر سفارش کمتر کند.',
  'The percentage cap reduces the configured discount rate.':
    'سقف درصدی، نرخ واردشده برای قانون را کاهش می‌دهد.',
  'An automatic promotion overlaps this period. Only one rule can apply.':
    'یک تخفیف خودکار دیگر با این بازه هم‌پوشانی دارد. خرید با یک قانون قیمت‌گذاری می‌شود.',
  'The sample basket total exceeds the allowed amount.': 'جمع سبد نمونه از حد مجاز بیشتر است.',
  'Choose available products for the sample basket.': 'برای سبد نمونه محصولات فعال را انتخاب کنید.',
  'No promotion has been saved for this campaign.': 'برای این کمپین هنوز قانون تخفیف ثبت نشده است.',
  'The sample customer is outside the promotion audience.':
    'مشتری نمونه در گروه مخاطب تعیین‌شده قرار نمی‌گیرد.',
  'The sample basket does not meet the promotion conditions.':
    'سبد نمونه شرایط دریافت تخفیف را ندارد.',
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
  'Display settings belong to the menu or announcement.':
    'تنظیمات نمایش را در جایگاه منو یا نوار اعلان وارد کنید.',
  'Choose either theme colors or custom placement colors.':
    'برای این جایگاه رنگ‌های تم یا رنگ‌های سفارشی را انتخاب کنید.',
  'Use a text color that contrasts with the campaign placement.':
    'رنگ متن باید روی پس‌زمینه و گرادیان جایگاه خوانا باشد.',
  'Choose a public storefront path.': 'یک مسیر عمومی فروشگاه مثل /products را وارد کنید.',
  'The encoded banner link is too long.': 'مسیر مقصد بنر بیش از حد طولانی است.',
  'The destination contains an unsupported or repeated parameter.':
    'پارامترهای مسیر مقصد را بررسی کنید.',
  'The destination already contains tracking parameters.':
    'پارامترهای ردیابی را از مسیر مقصد بردارید.',
  'Keep section dates inside the campaign window.': 'زمان هر بخش باید داخل بازهٔ کمپین باشد.',
  'Section artwork needs a desktop image in a content section.':
    'برای رسانهٔ بخش، ابتدا تصویر دسکتاپ را در یک بخش محتوایی انتخاب کنید.',
  'Keep the full product list enabled throughout the campaign.':
    'بخش همهٔ محصولات باید در سراسر کمپین فعال باشد.',
  'Set a maximum price for each budget group.': 'برای هر گروه بودجه سقف قیمت تعیین کنید.',
  'Use a text color that contrasts with all festival backgrounds.':
    'رنگ متن را طوری انتخاب کنید که روی هر دو پس‌زمینه و گرادیان خوانا باشد.',
  'Use readable text, badges and buttons on the festival card.':
    'رنگ متن، قیمت تخفیفی، نشان‌ها و دکمه باید روی سطح کارت خوانا باشند.',
  'Use a quota color that contrasts with the festival card.':
    'رنگ نوار سهمیه باید روی سطح کارت به‌خوبی دیده شود.',
  'Choose supported media with alternative text and a static fallback for GIFs.':
    'تصویر باید متن جایگزین داشته باشد. برای GIF، تصویر ثابت هم انتخاب کنید.',
  'The campaign changed. Reload it before submitting.': 'کمپین تغییر کرده است. صفحه را تازه کنید.',
  'Only draft campaigns can be edited.': 'ویرایش برای پیش‌نویس در دسترس است.',
  'This transition is unavailable for the current campaign status.':
    'این عملیات برای وضعیت فعلی کمپین در دسترس نیست.',
};

export function campaignMessage(message: string, fallback: string) {
  return Object.hasOwn(messages, message) ? messages[message] : fallback;
}

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
