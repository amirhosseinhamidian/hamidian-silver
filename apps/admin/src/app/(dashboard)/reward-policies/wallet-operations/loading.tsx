import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingWalletOperations() {
  return (
    <main
      className="admin-container space-y-4 py-6"
      aria-busy="true"
      aria-label="در حال دریافت اطلاعات کیف پول"
    >
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
    </main>
  );
}
