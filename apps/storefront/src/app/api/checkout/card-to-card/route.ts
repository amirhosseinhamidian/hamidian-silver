import {
  getCardToCardSettings,
  submitCardToCardReceipt,
} from '@/lib/checkout/bff';

export const GET = getCardToCardSettings;

export async function POST(request: Request) {
  return submitCardToCardReceipt(request);
}
