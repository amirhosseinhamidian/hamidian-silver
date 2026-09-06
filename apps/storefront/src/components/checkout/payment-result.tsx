import { ButtonLink } from '@/components/ui/button';

export type PaymentResultStatus = 'success' | 'pending' | 'failed';

type PaymentResultProps = Readonly<{
  status: PaymentResultStatus;
  orderId?: string;
  orderNumber?: string;
}>;

const RESULT_CONTENT: Record<
  PaymentResultStatus,
  Readonly<{ eyebrow: string; title: string; description: string }>
> = {
  success: {
    eyebrow: 'پرداخت موفق',
    title: 'پرداخت با موفقیت تأیید شد',
    description: 'سفارش شما ثبت شده و از بخش حساب کاربری قابل پیگیری است.',
  },
  pending: {
    eyebrow: 'بررسی پرداخت',
    title: 'نتیجه پرداخت در حال بررسی است',
    description:
      'تا مشخص‌شدن وضعیت نهایی، پرداخت را تکرار نکنید. وضعیت از حساب کاربری قابل پیگیری است.',
  },
  failed: {
    eyebrow: 'پرداخت ناموفق',
    title: 'پرداخت انجام نشد',
    description:
      'مبلغی از سمت فروشگاه تأیید نشد. در صورت کسر مبلغ، پیش از تکرار پرداخت وضعیت سفارش را بررسی کنید.',
  },
};

export function PaymentResult({ status, orderId, orderNumber }: PaymentResultProps) {
  const content = RESULT_CONTENT[status];

  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section className="mx-auto max-w-2xl border border-[var(--sf-color-border)] px-6 py-12 text-center sm:px-12 sm:py-16">
        <p className="text-xs font-medium tracking-[0.18em] text-[var(--sf-color-muted)]">
          {content.eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-normal sm:text-4xl">{content.title}</h1>
        {orderNumber ? <p className="mt-4 text-sm font-medium">سفارش {orderNumber}</p> : null}
        <p className="mx-auto mt-5 max-w-xl text-sm leading-8 text-[var(--sf-color-muted)]">
          {content.description}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {orderId ? (
            <ButtonLink href={`/account/orders/${encodeURIComponent(orderId)}`} variant="solid">
              مشاهده جزئیات سفارش
            </ButtonLink>
          ) : (
            <ButtonLink href="/account" variant="solid">
              مشاهده سفارش‌ها
            </ButtonLink>
          )}
          <ButtonLink href="/products">بازگشت به فروشگاه</ButtonLink>
        </div>
      </section>
    </main>
  );
}
