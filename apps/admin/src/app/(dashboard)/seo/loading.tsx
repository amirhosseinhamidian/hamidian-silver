import { Skeleton } from '@/components/ui/skeleton';

export default function SeoLoading() {
  return (
    <main className="admin-container py-6 sm:py-8">
      <div role="status" className="space-y-4" aria-label="در حال بارگذاری عملکرد جست‌وجو">
        <Skeleton className="h-8 w-52 max-w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}
