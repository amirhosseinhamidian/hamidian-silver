import { forwardReferral } from '@/lib/referrals/bff';

export function POST(request: Request) {
  return forwardReferral(request, 'claim');
}
