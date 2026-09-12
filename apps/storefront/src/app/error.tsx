'use client';

import ShopError from './(shop)/error';

export default function RootError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <ShopError error={error} reset={reset} fullPage />;
}
