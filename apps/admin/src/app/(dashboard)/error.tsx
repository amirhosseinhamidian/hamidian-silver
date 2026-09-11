'use client';

import { AdminErrorState } from '@/components/ui/admin-error-state';

export default function DashboardError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <AdminErrorState onRetry={reset} />;
}
