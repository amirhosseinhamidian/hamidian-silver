import { quoteCheckoutOrder } from '@/lib/checkout/bff';

export async function POST(request: Request) {
  return quoteCheckoutOrder(request);
}
