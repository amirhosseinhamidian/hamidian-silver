import { forwardPaymentTransactions } from '@/lib/transactions/payment-transactions-bff';

export async function GET(request: Request) {
  return forwardPaymentTransactions(request);
}
