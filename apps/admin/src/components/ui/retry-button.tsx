'use client';

import { Button } from '@/components/ui/button';

export function RetryButton({ label = 'تلاش دوباره' }: Readonly<{ label?: string }>) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
