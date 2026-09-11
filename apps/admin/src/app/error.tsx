'use client';

import { AdminErrorState } from '@/components/ui/admin-error-state';

export default function RootError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <AdminErrorState fullPage onRetry={reset} />;
}
