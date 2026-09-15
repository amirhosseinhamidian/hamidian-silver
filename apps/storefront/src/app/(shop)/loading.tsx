import { Skeleton } from '@/components/ui/skeleton';

export default function ShopLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-labelledby="storefront-loading-label"
      className="sf-container py-[var(--sf-section-space)]"
    >
      <p id="storefront-loading-label" role="status" className="sr-only">
        در حال بارگذاری صفحه
      </p>
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-5 h-10 w-56 max-w-full sm:w-80" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Skeleton className="aspect-[4/5] bg-[var(--sf-color-surface)]" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
