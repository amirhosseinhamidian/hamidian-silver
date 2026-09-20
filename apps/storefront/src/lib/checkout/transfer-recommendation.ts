export const TRANSFER_LIMITS_TOMAN = {
  cardToCard: 15_000_000,
  pol: 100_000_000,
  payaPerInstruction: 200_000_000,
} as const;

export const IRANIAN_BANKS = [
  'بانک ملی ایران',
  'بانک سپه',
  'بانک ملت',
  'بانک تجارت',
  'بانک صادرات ایران',
  'بانک رفاه کارگران',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک صنعت و معدن',
  'بانک توسعه صادرات ایران',
  'پست بانک ایران',
  'بانک اقتصاد نوین',
  'بانک پارسیان',
  'بانک پاسارگاد',
  'بانک سامان',
  'بانک سینا',
  'بانک شهر',
  'بانک آینده',
  'بانک گردشگری',
  'بانک ایران زمین',
  'بانک دی',
  'بانک خاورمیانه',
  'بانک کارآفرین',
  'بانک سرمایه',
  'بانک قرض‌الحسنه رسالت',
  'بانک قرض‌الحسنه مهر ایران',
  'مؤسسه اعتباری ملل',
] as const;

export type TransferRecommendation = Readonly<{
  method: 'CARD_TO_CARD' | 'POL' | 'SATNA' | 'SATNA_OR_ACCOUNT' | 'INTRA_BANK';
  title: string;
  speed: string;
  description: string;
  alternative: string | null;
}>;

function canonicalBankName(value: string): string {
  return value
    .trim()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/م[ؤو]سسه\s+اعتباری/g, '')
    .replace(/قرض[‌\s-]*الحسنه/g, '')
    .replace(/پست\s*بانک/g, 'پست')
    .replace(/بانک/g, '')
    .replace(/ایران/g, '')
    .replace(/کارگران/g, '')
    .replace(/\s+/g, '');
}

export function banksMatch(sourceBank: string, destinationBank: string): boolean {
  const source = canonicalBankName(sourceBank);
  const destination = canonicalBankName(destinationBank);
  return Boolean(source && destination && source === destination);
}

function networkRecommendation(amountToman: number): TransferRecommendation {
  if (amountToman <= TRANSFER_LIMITS_TOMAN.cardToCard) {
    return {
      method: 'CARD_TO_CARD',
      title: 'کارت‌به‌کارت',
      speed: 'تقریباً آنی',
      description: 'مبلغ این سفارش در محدوده سقف روزانه کارت‌به‌کارت هر کارت است.',
      alternative: null,
    };
  }

  if (amountToman <= TRANSFER_LIMITS_TOMAN.pol) {
    return {
      method: 'POL',
      title: 'پل با شماره شبا',
      speed: 'لحظه‌ای',
      description:
        'در همراه‌بانک یا اینترنت‌بانک، انتقال با شبا و گزینه «پل / انتقال لحظه‌ای» را انتخاب کنید.',
      alternative: 'اگر بانک مبدأ پل را ارائه نمی‌کند، از پایا یا ساتنا استفاده کنید.',
    };
  }

  if (amountToman <= TRANSFER_LIMITS_TOMAN.payaPerInstruction) {
    return {
      method: 'SATNA',
      title: 'ساتنا برای انتقال سریع',
      speed: 'سریع در ساعات فعالیت سامانه',
      description: 'برای جابه‌جایی سریع این مبلغ، انتقال ساتنا با شماره شبا پیشنهاد می‌شود.',
      alternative: 'اگر فوریت ندارید، پایا تا سقف هر دستور پرداخت گزینه سیکلی مناسبی است.',
    };
  }

  return {
    method: 'SATNA_OR_ACCOUNT',
    title: 'ساتنا یا انتقال حسابی',
    speed: 'وابسته به بانک و زمان ثبت',
    description:
      'این مبلغ از سقف متعارف یک دستور پایا بیشتر است؛ از ساتنا یا خدمات انتقال حسابی بانک مبدأ استفاده کنید.',
    alternative: 'ممکن است بانک برای انتقال غیرحضوری سقف اختصاصی یا مراجعه حضوری تعیین کرده باشد.',
  };
}

export function recommendTransfer(
  amountToman: number,
  sourceBank: string,
  destinationBank: string,
): TransferRecommendation {
  const network = networkRecommendation(amountToman);
  if (!sourceBank || !banksMatch(sourceBank, destinationBank)) return network;

  return {
    method: 'INTRA_BANK',
    title: 'انتقال درون‌بانکی / حساب‌به‌حساب',
    speed: 'معمولاً آنی',
    description:
      'بانک مبدأ و مقصد یکسان است. در اپ بانک، انتقال درون‌بانکی یا حساب‌به‌حساب معمولاً سریع‌ترین انتخاب است و ممکن است سقف بیشتری داشته باشد.',
    alternative: `اگر این گزینه در دسترس نبود، پیشنهاد شبکه بانکی برای این مبلغ: ${network.title}.`,
  };
}
