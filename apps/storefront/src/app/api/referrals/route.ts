import { forwardReferral } from '@/lib/referrals/bff';

export function GET(request: Request) {
  return forwardReferral(request, 'overview');
}
