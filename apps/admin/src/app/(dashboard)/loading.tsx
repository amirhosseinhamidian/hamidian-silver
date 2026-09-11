import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <div role="status" aria-label="در حال بارگذاری پنل" className="space-y-5">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" aria-hidden="true" />
      </div>
    </main>
  );
}
