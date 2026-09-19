import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import {
  getPublicShippingOptions,
  getPublicShippingPricing,
} from '@/lib/shipping/public-shipping-pricing';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const shippingOptions = await getPublicShippingOptions();
  const e2eShippingPricing =
    process.env.STOREFRONT_E2E === 'true' ? await getPublicShippingPricing() : null;
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <header className="border-b border-[var(--sf-color-border)] pb-8">
        <p className="text-sm text-[var(--sf-color-muted)]">تکمیل خرید</p>
        <h1 className="mt-3 text-4xl font-normal sm:text-5xl">ثبت سفارش و پرداخت</h1>
      </header>

      <CheckoutFlow shippingOptions={shippingOptions} shippingPricing={e2eShippingPricing} />
    </main>
  );
}
